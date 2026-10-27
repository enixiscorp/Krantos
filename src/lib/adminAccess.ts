// ============================================================
// Krantos Platform - Back-office identity & access rules
// ============================================================

import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** The main administrator (owner of the platform). */
export const MAIN_ADMIN_EMAIL = 'contacteccorp@gmail.com';

export type StaffRole = 'main' | 'super_admin' | 'admin_principal' | 'admin_collaborateur';

export interface AdminUserRow {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin_principal' | 'admin_collaborateur';
  phone?: string | null;
  created_at: string;
  archived_at?: string | null;
}

export interface StaffIdentity {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isMainAdmin: boolean;
  /** null = not (or no longer) a member of the Krantos team */
  role: StaffRole | null;
  adminUser: AdminUserRow | null;
}

export function isMainAdminEmail(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === MAIN_ADMIN_EMAIL;
}

export function isArchived(row?: { archived_at?: string | null } | null): boolean {
  return !!row?.archived_at;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Best first name for signing messages. */
export function pickFirstName(opts: {
  profileFirstName?: string | null;
  adminUserName?: string | null;
  metadataFirstName?: string | null;
  email?: string | null;
}): string {
  const fromName = opts.adminUserName?.trim().split(/\s+/)[0];
  const fromEmail = opts.email?.split('@')[0]?.split(/[._-]/)[0];
  return capitalize(
    opts.profileFirstName?.trim() || fromName || opts.metadataFirstName?.trim() || fromEmail || 'Krantos'
  );
}

/** Loads who is connected to the back-office (null when not logged in). */
export async function loadStaffIdentity(user?: User | null): Promise<StaffIdentity | null> {
  let current = user ?? null;
  if (!current) {
    const { data } = await supabase.auth.getSession();
    current = data.session?.user ?? null;
  }
  if (!current) return null;

  const [{ data: profile }, { data: adminRow }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', current.id).maybeSingle(),
    // select('*'): works before and after the archived_at column exists
    supabase.from('admin_users').select('*').eq('auth_user_id', current.id).maybeSingle(),
  ]);

  const adminUser = (adminRow as AdminUserRow | null) ?? null;
  const email = current.email ?? '';
  const isMainAdmin = isMainAdminEmail(email) || profile?.role === 'super_admin';

  let role: StaffRole | null = null;
  if (isMainAdmin) role = 'main';
  else if (adminUser && !isArchived(adminUser)) role = adminUser.role;
  else if (!adminUser && profile?.role === 'admin') role = 'admin_collaborateur';

  const meta = (current.user_metadata ?? {}) as { first_name?: string; last_name?: string };
  return {
    userId: current.id,
    email,
    firstName: pickFirstName({
      profileFirstName: profile?.first_name,
      adminUserName: adminUser?.name,
      metadataFirstName: meta.first_name,
      email,
    }),
    lastName: profile?.last_name?.trim() || meta.last_name?.trim() || '',
    phone: profile?.phone ?? adminUser?.phone ?? null,
    isMainAdmin,
    role,
    adminUser,
  };
}
