// Protection route /admin/* : super_admin uniquement
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

const SuperAdminRoute = ({ children }: Props) => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/admin-login', { replace: true });
        return;
      }

      try {
        const userEmail = sessionData.session.user.email;
        
        // Force access for the main admin
        if (userEmail === 'contacteccorp@gmail.com') {
          setAllowed(true);
          setReady(true);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', sessionData.session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profile?.role === 'super_admin') {
          setAllowed(true);
          setReady(true);
          return;
        }

        // Fallback: Si super_admin via admin_users (admin_principal)
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('role')
          .eq('auth_user_id', sessionData.session.user.id)
          .maybeSingle();

        if (mounted) {
          if (adminUser?.role === 'admin_principal') {
            setAllowed(true);
            setReady(true);
          } else {
            toast.error('Accès réservé au super administrateur.');
            navigate('/admin-login', { replace: true });
          }
        }
      } catch (err) {
        console.error('SuperAdminRoute Error:', err);
        if (mounted) navigate('/admin-login', { replace: true });
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
          <p className="text-gray-500 text-sm">Vérification des accès…</p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
};

export default SuperAdminRoute;
