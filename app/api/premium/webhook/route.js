import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured } from '@/lib/stripe';

// Stripe needs the raw, unparsed body to verify its signature.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The ONLY place premium access is ever granted. It happens here, after
 * Stripe's cryptographic signature proves the payment really happened —
 * never from a client-side "I paid" call, and never from the checkout
 * success_url, which is just a redirect a user can visit directly without
 * paying. Same reasoning as the (shelved) Campus Archive webhook this
 * mirrors — a separate endpoint with its own signing secret, since this is
 * a different Stripe product entirely.
 */
export async function POST(request) {
  if (!stripeConfigured()) {
    return Response.json({ error: 'Payments not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return Response.json({ error: 'Missing signature.' }, { status: 400 });

  const raw = await request.text();

  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_PREMIUM_WEBHOOK_SECRET);
  } catch (err) {
    console.error('premium webhook signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const ok = await saveSubscription(admin, event.data.object);
    return ok
      ? Response.json({ received: true })
      : Response.json({ error: 'Could not record subscription.' }, { status: 500 });
  }

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true });
  }

  const session = event.data.object;
  if (session.mode !== 'subscription' || !session.subscription) {
    return Response.json({ received: true, note: 'not a subscription session' });
  }

  const sub = await stripe().subscriptions.retrieve(session.subscription);
  // user_id comes from metadata WE set at checkout creation; the signature proves it is untampered.
  const userId = session.metadata?.user_id || sub.metadata?.user_id;
  if (!userId) {
    console.error('premium webhook missing user_id', session.id);
    return Response.json({ received: true, note: 'missing metadata' });
  }
  const ok = await saveSubscription(admin, sub, userId);
  return ok
    ? Response.json({ received: true })
    : Response.json({ error: 'Could not record subscription.' }, { status: 500 });
}

/**
 * Upsert one user's subscription row from a Stripe subscription object.
 * Safe to replay — Stripe retries webhooks, and the row is keyed by user.
 * Returns false on failure so the caller answers 500 and Stripe retries
 * (a paying user must never be silently dropped).
 */
async function saveSubscription(admin, sub, knownUserId) {
  let userId = knownUserId || sub.metadata?.user_id;
  if (!userId) {
    const { data } = await admin.from('premium_subscriptions')
      .select('user_id').eq('stripe_subscription_id', sub.id).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) {
    console.error('premium subscription event with no known user', sub.id);
    return true; // Nothing we can attach it to; retrying won't help.
  }

  // Newer Stripe API versions moved the period end onto the subscription item.
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const { error } = await admin.from('premium_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) { console.error('failed to save premium subscription:', error); return false; }

  return true;
}
