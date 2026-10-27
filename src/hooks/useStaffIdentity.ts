import { useCallback, useEffect, useState } from 'react';
import { loadStaffIdentity, type StaffIdentity } from '../lib/adminAccess';

/** The connected Krantos team member (first name, role, main admin...). */
export function useStaffIdentity() {
  const [identity, setIdentity] = useState<StaffIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setIdentity(await loadStaffIdentity());
    } catch (err) {
      console.warn('[useStaffIdentity]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { identity, loading, reload };
}
