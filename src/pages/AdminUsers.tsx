// ============================================================
// Krantos Platform - /admin/users (team management)
// ============================================================
// - Everyone in the team can edit his own details ("Mon profil").
// - Main admin and "Principal" admins can edit team members.
// - Nobody can edit the main admin except himself.
// - Only the main admin can delete a member: the profile is ARCHIVED
//   (access removed, data kept) and can be restored from "Archivés".
// All changes go through admin-checked database functions
// (supabase/migrations/20240032_admin_users_management.sql).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Loader2,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Mail,
  Phone,
  Search,
  Pencil,
  Archive,
  ArchiveRestore,
  Crown,
  X,
  Save,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isArchived, isMainAdminEmail, type AdminUserRow } from '../lib/adminAccess';
import { useStaffIdentity } from '../hooks/useStaffIdentity';

type AdminRole = AdminUserRow['role'];

const ROLE_CONFIG: Record<AdminRole, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  super_admin: {
    label: 'Propriétaire',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    icon: <ShieldAlert className="w-5 h-5 text-yellow-400" />,
  },
  admin_principal: {
    label: 'Principal',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
  },
  admin_collaborateur: {
    label: 'Collaborateur',
    color: 'text-gray-400',
    bg: 'bg-white/5 border-white/10',
    icon: <Shield className="w-5 h-5 text-gray-400" />,
  },
};

const ASSIGNABLE_ROLES: AdminRole[] = ['admin_principal', 'admin_collaborateur'];

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 disabled:opacity-50';
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1';

/** Clear message for database function errors. */
function rpcErrorMessage(err: { message?: string; code?: string } | null): string {
  if (!err) return 'Erreur inconnue.';
  if (err.code === 'PGRST202' || err.code === '42703' || /Could not find the function|does not exist/i.test(err.message ?? '')) {
    return 'La base de données n’est pas à jour : exécutez le script supabase/queries/apply_pending_updates.sql dans Supabase (SQL Editor), puis réessayez.';
  }
  return err.message ?? 'Erreur inconnue.';
}

function isMainTarget(u: AdminUserRow): boolean {
  return u.role === 'super_admin' || isMainAdminEmail(u.email);
}

const AdminUsers = () => {
  const { identity, reload: reloadIdentity } = useStaffIdentity();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin_collaborateur');
  const [adding, setAdding] = useState(false);

  // Edit a member
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('admin_collaborateur');
  const [saving, setSaving] = useState(false);

  // My profile
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [myFirst, setMyFirst] = useState('');
  const [myLast, setMyLast] = useState('');
  const [myPhone, setMyPhone] = useState('');

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erreur lors du chargement des administrateurs.');
    else setUsers((data ?? []) as AdminUserRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  const isMain = !!identity?.isMainAdmin;
  const canManageOthers = isMain || identity?.role === 'super_admin' || identity?.role === 'admin_principal';
  const isSelf = (u: AdminUserRow) => !!identity && u.auth_user_id === identity.userId;
  const canEdit = (u: AdminUserRow) => !isArchived(u) && (isSelf(u) || (!isMainTarget(u) && canManageOthers));
  const canArchive = (u: AdminUserRow) => isMain && !isMainTarget(u) && !isSelf(u) && !isArchived(u);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddUser = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }
    setAdding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) throw new Error('Session expirée, reconnectez-vous.');

      const parts = newName.trim().split(/\s+/);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          first_name: parts[0],
          last_name: parts.slice(1).join(' ') || '-',
          email: newEmail.trim(),
          role: newRole,
        }),
      });
      const json = (await res.json()) as { error?: string; password_reset_link?: string | null };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      toast.success(`${newName.trim()} a été ajouté.`);
      if (json.password_reset_link) {
        toast.info('Lien de définition du mot de passe généré (voir console).');
        console.info('[AdminUsers] password_reset_link:', json.password_reset_link);
      }
      setShowAddModal(false);
      setNewName(''); setNewEmail(''); setNewRole('admin_collaborateur');
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l’ajout.');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (u: AdminUserRow) => {
    setEditing(u);
    setEditName(u.name);
    setEditPhone(u.phone ?? '');
    setEditRole(u.role);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) { toast.error('Le nom est obligatoire.'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('update_admin_user', {
      p_admin_id: editing.id,
      p_name: editName.trim(),
      p_phone: editPhone.trim() || null,
      p_role: isSelf(editing) || isMainTarget(editing) ? null : editRole,
    });
    setSaving(false);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success('Profil mis à jour.');
    setEditing(null);
    await loadUsers();
    if (isSelf(editing)) await reloadIdentity();
  };

  const openMyProfile = () => {
    setMyFirst(identity?.firstName ?? '');
    setMyLast(identity?.lastName ?? '');
    setMyPhone(identity?.phone ?? '');
    setShowMyProfile(true);
  };

  const handleSaveMyProfile = async () => {
    if (!myFirst.trim()) { toast.error('Le prénom est obligatoire.'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('update_my_staff_profile', {
      p_first_name: myFirst.trim(),
      p_last_name: myLast.trim(),
      p_phone: myPhone.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success('Vos informations sont à jour. Elles signent désormais vos messages Krantos.');
    setShowMyProfile(false);
    await Promise.all([reloadIdentity(), loadUsers()]);
  };

  const handleArchive = async (u: AdminUserRow) => {
    if (!confirm(`Supprimer le profil de ${u.name} ?\n\nIl perdra son accès à l'administration. Le profil sera archivé et vous pourrez le restaurer à tout moment.`)) return;
    setBusyId(u.id);
    const { error } = await supabase.rpc('archive_admin_user', { p_admin_id: u.id });
    setBusyId(null);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success(`${u.name} a été archivé.`, {
      action: { label: 'Annuler', onClick: () => void handleRestore(u) },
    });
    await loadUsers();
  };

  const handleRestore = async (u: AdminUserRow) => {
    setBusyId(u.id);
    const { error } = await supabase.rpc('restore_admin_user', { p_admin_id: u.id });
    setBusyId(null);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success(`${u.name} a été restauré et retrouve son accès.`);
    await loadUsers();
  };

  // ---------------------------------------------------------------------------
  // Lists
  // ---------------------------------------------------------------------------

  const { activeUsers, archivedUsers } = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const matches = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return {
      activeUsers: matches.filter((u) => !isArchived(u)),
      archivedUsers: matches.filter((u) => isArchived(u)),
    };
  }, [users, searchTerm]);
  const shown = tab === 'active' ? activeUsers : archivedUsers;

  if (loading && users.length === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-4xl font-black text-white mb-2">Utilisateurs</h1>
          <p className="text-gray-500 text-lg">Gestion de l’équipe Krantos.</p>
        </div>
        {isMain && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all accent-glow"
          >
            <UserPlus className="w-5 h-5" />
            Nouvel Admin
          </button>
        )}
      </div>

      {/* My profile */}
      {identity && (
        <div className="glass-card p-6 rounded-3xl border-yellow-400/20 bg-yellow-400/[0.03] mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center flex-shrink-0">
              {isMain ? <Crown className="w-5 h-5 text-yellow-400" /> : <Shield className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
                Mon profil{isMain ? ' · Administrateur principal' : ''}
              </p>
              <p className="text-white font-bold truncate">
                {identity.firstName} {identity.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {identity.email}{identity.phone ? ` · ${identity.phone}` : ''} · signe les messages Krantos « {identity.firstName} »
              </p>
            </div>
          </div>
          <button
            onClick={openMyProfile}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all"
          >
            <Pencil className="w-4 h-4" /> Modifier mes informations
          </button>
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 self-start">
          {([
            ['active', `Actifs (${activeUsers.length})`],
            ['archived', `Archivés (${archivedUsers.length})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === id ? 'bg-yellow-400 text-black' : 'text-gray-500 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative group flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-yellow-400 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
          />
        </div>
      </div>

      {tab === 'archived' && (
        <p className="text-xs text-gray-500 mb-6">
          Les profils archivés n’ont plus accès à l’administration. Leurs données sont conservées.
          {isMain ? ' Vous pouvez les restaurer à tout moment.' : ' Seul l’administrateur principal peut les restaurer.'}
        </p>
      )}

      {/* List */}
      {shown.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border-white/5 text-center text-gray-500 text-sm">
          {tab === 'active' ? 'Aucun membre trouvé.' : 'Aucun profil archivé.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((u, i) => {
            const cfg = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.admin_collaborateur;
            const main = isMainTarget(u);
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all group relative overflow-hidden ${isArchived(u) ? 'opacity-70' : ''}`}
              >
                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.color} border-l border-b border-white/5`}>
                  {main ? 'Administrateur principal' : cfg.label}
                </div>

                <div className="flex flex-col h-full pt-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    {main ? <Crown className="w-5 h-5 text-yellow-400" /> : cfg.icon}
                  </div>

                  <h3 className="font-bold text-white text-lg mb-1 tracking-tight">
                    {u.name}{isSelf(u) && <span className="text-xs text-yellow-400 font-black ml-2">(vous)</span>}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <Mail className="w-3 h-3" /> {u.email}
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                      <Phone className="w-3 h-3" /> {u.phone}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/5 gap-2">
                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                      {isArchived(u)
                        ? `Archivé le ${new Date(u.archived_at as string).toLocaleDateString('fr-FR')}`
                        : `Ajouté le ${new Date(u.created_at).toLocaleDateString('fr-FR')}`}
                    </span>
                    <div className="flex items-center gap-1">
                      {busyId === u.id && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
                      {canEdit(u) && (
                        <button
                          onClick={() => openEdit(u)}
                          className="p-2 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
                          title="Modifier le profil"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {canArchive(u) && (
                        <button
                          onClick={() => handleArchive(u)}
                          disabled={busyId !== null}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                          title="Supprimer (archiver) le profil"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      {isArchived(u) && isMain && (
                        <button
                          onClick={() => handleRestore(u)}
                          disabled={busyId !== null}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-400/10 hover:bg-green-400/20 transition-all disabled:opacity-40"
                          title="Restaurer le profil"
                        >
                          <ArchiveRestore className="w-4 h-4" /> Restaurer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---------------- Modals ---------------- */}
      <AnimatePresence>
        {(showAddModal || editing || showMyProfile) && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddModal(false); setEditing(null); setShowMyProfile(false); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full max-w-md max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border border-white/10 p-8 sm:p-10 rounded-t-[2rem] sm:rounded-[2.5rem]"
            >
              <button
                onClick={() => { setShowAddModal(false); setEditing(null); setShowMyProfile(false); }}
                className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              {showAddModal && (
                <>
                  <h2 className="text-2xl font-black text-white mb-6 tracking-tight">Nouvel administrateur</h2>
                  <div className="space-y-6">
                    <div>
                      <label className={labelCls}>Nom complet</label>
                      <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jean Dupont" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jean@exemple.com" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Rôle</label>
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)} className={inputCls}>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r} className="bg-[#0a0a0c]">{ROLE_CONFIG[r].label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddUser}
                      disabled={adding}
                      className="w-full py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Créer l’accès
                    </button>
                  </div>
                </>
              )}

              {editing && (
                <>
                  <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Modifier le profil</h2>
                  <p className="text-xs text-gray-500 mb-6">{editing.email}</p>
                  <div className="space-y-6">
                    <div>
                      <label className={labelCls}>Nom complet</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Téléphone</label>
                      <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+228 90 00 00 00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Rôle</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as AdminRole)}
                        disabled={isSelf(editing) || isMainTarget(editing)}
                        className={inputCls}
                      >
                        {(isMainTarget(editing) ? [editing.role] : ASSIGNABLE_ROLES).map((r) => (
                          <option key={r} value={r} className="bg-[#0a0a0c]">{ROLE_CONFIG[r].label}</option>
                        ))}
                      </select>
                      {isSelf(editing) && <p className="text-[11px] text-gray-600 mt-2 ml-1">Vous ne pouvez pas changer votre propre rôle.</p>}
                    </div>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="w-full py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                    </button>
                  </div>
                </>
              )}

              {showMyProfile && (
                <>
                  <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Mes informations</h2>
                  <p className="text-xs text-gray-500 mb-6">
                    Votre prénom signe les messages envoyés aux clients au nom de Krantos.
                  </p>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Prénom</label>
                        <input type="text" value={myFirst} onChange={(e) => setMyFirst(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Nom</label>
                        <input type="text" value={myLast} onChange={(e) => setMyLast(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Téléphone</label>
                      <input type="tel" value={myPhone} onChange={(e) => setMyPhone(e.target.value)} placeholder="+228 90 00 00 00" className={inputCls} />
                    </div>
                    <button
                      onClick={handleSaveMyProfile}
                      disabled={saving}
                      className="w-full py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;
