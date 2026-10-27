// Protection route /admin/users : équipe Krantos active (rôle vérifié par action)
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { loadStaffIdentity } from '../lib/adminAccess';

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
      try {
        const identity = await loadStaffIdentity();
        if (!mounted) return;
        if (!identity) {
          navigate('/admin-login', { replace: true });
          return;
        }
        // Active Krantos team only (main admin, principal, collaborator).
        // What each one may do on the page depends on the role.
        if (identity.role) {
          setAllowed(true);
          setReady(true);
          return;
        }
        toast.error('Accès réservé à l’équipe Krantos.');
        navigate('/admin-login', { replace: true });
      } catch (err) {
        console.error('SuperAdminRoute Error:', err);
        if (mounted) navigate('/admin-login', { replace: true });
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
          <p className="text-gray-500 text-sm">Vérification des accès…</p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
};

export default SuperAdminRoute;
