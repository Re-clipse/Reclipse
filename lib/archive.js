import { supabase } from '@/lib/supabaseClient';

/** True when the signed-in user has an active Campus Archive subscription. */
export async function hasArchiveAccess() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from('archive_subscriptions')
    .select('status, current_period_end').eq('user_id', session.user.id).maybeSingle();
  if (!data) return false;
  return ['active', 'trialing'].includes(data.status)
    && (!data.current_period_end || new Date(data.current_period_end) > new Date());
}

async function post(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { needsLogin: true };
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, ...data };
}

/** Returns { url } to redirect to, { needsLogin }, or { error }. */
export const startArchiveCheckout = (deckId) => post('/api/archive/subscribe', { deckId });
export const openBillingPortal = () => post('/api/archive/portal');
