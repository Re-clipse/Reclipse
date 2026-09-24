import { supabase } from '@/lib/supabaseClient';

/** Returns { code, link } for the signed-in user, or null if signed out / on error. */
export async function getReferralCode() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch('/api/referral/code', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (!res.ok) return null;
    const link = typeof window !== 'undefined' ? `${window.location.origin}/login?mode=signup&ref=${data.code}` : '';
    return { code: data.code, link };
  } catch {
    return null;
  }
}
