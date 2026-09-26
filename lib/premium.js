import { supabase } from '@/lib/supabaseClient';
import { isLaunchTrialActive } from '@/lib/premiumTrial';

export { isLaunchTrialActive };

/** True when the signed-in user has premium — either the launch trial, or a real subscription. */
export async function hasPremiumAccess() {
  if (isLaunchTrialActive()) return true;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.rpc('has_premium_access');
  return Boolean(data);
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

/** Returns { url } to redirect to, { needsLogin }, or { error }. interval: 'month' | 'year'. */
export const startPremiumCheckout = (interval = 'month') => post('/api/premium/subscribe', { interval });
export const openPremiumBillingPortal = () => post('/api/premium/portal');

/** Public — no auth. Returns { amountCents, currency, interval } or null if pricing isn't configured yet. */
export async function getPremiumPrice(interval = 'month') {
  try {
    const res = await fetch(`/api/premium/price?interval=${interval}`);
    const data = await res.json();
    return data.price || null;
  } catch {
    return null;
  }
}

export function formatPremiumPrice(price) {
  if (!price) return null;
  const amount = (price.amountCents / 100).toLocaleString(undefined, {
    style: 'currency', currency: price.currency.toUpperCase(), minimumFractionDigits: price.amountCents % 100 ? 2 : 0,
  });
  return `${amount}/${price.interval === 'year' ? 'yr' : 'mo'}`;
}
