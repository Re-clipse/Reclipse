'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/**
 * Shared auth guard. Every protected page used to roll its own slightly
 * different redirect logic; this replaces all of them.
 * Returns { user, loading } and redirects to login when signed out.
 */
export function useAuth({ redirectTo } = {}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) {
        const next = redirectTo || window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setUser(data.session.user);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [router, redirectTo]);

  return { user, loading };
}
