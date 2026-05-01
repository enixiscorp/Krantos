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
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          navigate('/admin-login', { replace: true });
          return;
        }

        const uid = sessionData.session.user.id;
        const userEmail = sessionData.session.user.email;

        // Force access for the main admin email (Super-Super Admin)
        if (userEmail === 'contacteccorp@gmail.com') {
          setAllowed(true);
          setReady(true);
          return;
        }

        // 1) Essayer de récupérer le rôle dans profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .maybeSingle();

        if (mounted && profile && (profile.role === 'super_admin' || profile.role === 'admin')) {
          setAllowed(true);
          setReady(true);
          return;
        }

        // 2) Fallback : vérifier dans admin_users
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, role')
          .eq('auth_user_id', uid)
          .maybeSingle();

        if (mounted) {
          if (adminUser) {
            setAllowed(true);
            setReady(true);
          } else {
            console.warn('Accès Admin refusé pour UID:', uid);
            toast.error('Accès refusé. Droits insuffisants.');
            navigate('/', { replace: true });
          }
        }
      } catch (err) {
        console.error('AdminRoute Error:', err);
        if (mounted) navigate('/', { replace: true });
      }
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

