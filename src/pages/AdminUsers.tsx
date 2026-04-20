// ============================================================
// Krantos Platform — /admin/users (Premium Dark Overhaul)
// Requirements: C8.1, C8.2 (Admin user management)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Mail,
  Trash2,
  Search,
  MoreVertical,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdminRole = 'super_admin' | 'admin_principal' | 'admin_collaborateur';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_CONFIG: Record<
  AdminRole,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  super_admin: {
    label: 'Propriétaire',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
  },
  admin_principal: {
    label: 'Principal',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
  admin_collaborateur: {
    label: 'Collaborateur',
    color: 'text-gray-400',
    bg: 'bg-white/5 border-white/10',
    icon: <Shield className="w-3.5 h-3.5" />,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminUsers = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Add User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin_collaborateur');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erreur lors du chargement des administrateurs.');
      } else if (mounted) {
        setUsers(data ?? []);
      }
      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddUser = async () => {
    if (!newName || !newEmail) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    toast.info("L'invitation des administrateurs utilise Supabase Auth Invite. Simulation en cours...");
    
    // In a real app, you would call a Supabase Edge Function to invite the user
    // For this UI demo, we simulate the database record creation
    setLoading(true);
    try {
      const { error } = await supabase
        .from('admin_users')
        .insert({
          name: newName,
          email: newEmail,
          role: newRole,
          auth_user_id: crypto.randomUUID(), // Mock ID for simulation
        });

      if (error) throw error;

      toast.success(`${newName} a été ajouté.`);
      setShowAddModal(false);
      setNewName(''); setNewEmail('');
      
      // Refresh
      const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });
      setUsers(data ?? []);
    } catch (err) {
      toast.error('Erreur lors de l’ajout.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'accès de ${name} ?`)) return;

    const { error } = await supabase.from('admin_users').delete().eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression.');
    } else {
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success('Accès révoqué.');
    }
  };

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-4xl font-black text-white mb-2">Utilisateurs</h1>
          <p className="text-gray-500 text-lg">Gestion des accès administratifs internes.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all accent-glow"
        >
          <UserPlus className="w-5 h-5" />
          Nouvel Admin
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-yellow-400 transition-colors" />
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((u, i) => {
          const cfg = ROLE_CONFIG[u.role];
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all group relative overflow-hidden"
            >
              {/* Role Badge pinned Top-Right */}
              <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.color} border-l border-b border-white/5`}>
                {cfg.label}
              </div>

              <div className="flex flex-col h-full pt-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {cfg.icon}
                </div>
                
                <h3 className="font-bold text-white text-lg mb-1 tracking-tight">{u.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-6 font-medium">
                  <Mail className="w-3 h-3" />
                  {u.email}
                </div>

                <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                  <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                    Ajouté le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  <button
                    onClick={() => handleDelete(u.id, u.name)}
                    className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="Supprimer l'accès"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md glass-card p-10 rounded-[2.5rem] border-white/5 relative z-10"
            >
              <h2 className="text-2xl font-black text-white mb-6 tracking-tight">Nouvel Administrateur</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Nom Complet</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="jean@krantos.ht"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Rôle</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as AdminRole)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                  >
                    {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key} className="bg-[#0a0a0c]">{cfg.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAddUser}
                    className="flex-[2] py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20"
                  >
                    Créer l'accès
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;
