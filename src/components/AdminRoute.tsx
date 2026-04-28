// Protection route /admin/* : super_admin OU admin staff (admin_users)
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppRole } from '../lib/supabase';

interface Props {
  children: ReactNode;
}

const AdminRoute = ({ children }: Props) => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      // 1) super_admin via profiles.role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sessionData.session.user.id)
        .single();

      if (!mounted) return;

      if (!profileError && profile && (profile.role as AppRole) === 'super_admin') {
        setAllowed(true);
        setReady(true);
        return;
      }

      // 2) admin staff via admin_users table (RLS: only admins can read)
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('id, role')
        .eq('auth_user_id', sessionData.session.user.id)
        .single();

      if (!mounted) return;

      if (adminError || !adminUser) {
        toast.error('Accès refusé.');
        navigate('/', { replace: true });
        return;
      }

      setAllowed(true);
      setReady(true);
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Vérification des accès admin…</p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
};

export default AdminRoute;

