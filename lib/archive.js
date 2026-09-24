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

/** Public — no auth. Returns { amountCents, currency, interval } or null if pricing isn't configured yet. */
export async function getArchivePrice() {
  try {
    const res = await fetch('/api/archive/price');
    const data = await res.json();
    return data.price || null;
  } catch {
    return null;
  }
}

export function formatArchivePrice(price) {
  if (!price) return null;
  const amount = (price.amountCents / 100).toLocaleString(undefined, {
    style: 'currency', currency: price.currency.toUpperCase(), minimumFractionDigits: price.amountCents % 100 ? 2 : 0,
  });
  return `${amount}/${price.interval === 'month' ? 'mo' : price.interval}`;
}
