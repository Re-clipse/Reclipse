'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/**
 * Shared auth guard. Every protected page used to roll its own slightly
 * different redirect logic; this replaces all of them.
 * Returns { user, loading } and redirects to login when signed out.
 *
 * Also enforces two-factor: a password-only session (AAL1) on an account
 * that has 2FA enrolled is NOT treated as logged in here — without this
 * check, someone could skip the code prompt entirely by navigating straight
 * to a protected page right after the password step, since Supabase issues
 * a session immediately on password success and leaves AAL enforcement to
 * the app.
 */
export function useAuth({ redirectTo } = {}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const next = redirectTo || window.location.pathname + window.location.search;
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!alive) return;
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
        router.replace(`/login?mfa=1&next=${encodeURIComponent(next)}`);
        return;
      }

      setUser(data.session.user);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [router, redirectTo]);

  return { user, loading };
}
