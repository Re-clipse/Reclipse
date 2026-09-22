import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured } from '@/lib/stripe';

// Stripe needs the raw, unparsed body to verify its signature.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The ONLY place archive access is ever granted. It happens here, after
 * Stripe's cryptographic signature proves the payment really happened —
 * never from a client-side "I paid" call, which anyone could forge, and
 * never from the checkout success_url, which is just a redirect a user can
 * visit directly without paying.
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
    event = stripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // ---- Subscription lifecycle ----
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

  // ---- New subscription ----
  if (session.mode === 'subscription') {
    if (!session.subscription) return Response.json({ received: true, note: 'no subscription' });
    const sub = await stripe().subscriptions.retrieve(session.subscription);
    // user_id comes from metadata WE set at checkout creation; the signature proves it is untampered.
    const userId = session.metadata?.user_id || sub.metadata?.user_id;
    if (!userId) {
      console.error('webhook missing user_id', session.id);
      return Response.json({ received: true, note: 'missing metadata' });
    }
    const ok = await saveSubscription(admin, sub, userId);
    return ok
      ? Response.json({ received: true })
      : Response.json({ error: 'Could not record subscription.' }, { status: 500 });
  }

  // ---- Legacy per-deck purchase (no longer sold; kept so in-flight payments still land) ----
  if (session.payment_status !== 'paid') {
    return Response.json({ received: true, note: 'not paid' });
  }

  const deckId = session.metadata?.deck_id;
  const buyerId = session.metadata?.buyer_user_id;
  if (!deckId || !buyerId) {
    console.error('webhook missing metadata', session.id);
    return Response.json({ received: true, note: 'missing metadata' });
  }

  // upsert + the unique (deck_id, buyer_user_id) constraint makes this safe to
  // replay — Stripe retries webhooks, and double-granting or double-counting
  // a sale would both be wrong.
  const { error } = await admin.from('deck_purchases').upsert({
    deck_id: deckId,
    buyer_user_id: buyerId,
    amount_cents: session.amount_total ?? 0,
    stripe_session_id: session.id,
  }, { onConflict: 'deck_id,buyer_user_id' });

  if (error) {
    console.error('failed to record purchase:', error);
    // 500 so Stripe retries — the user paid, so we must not silently drop this.
    return Response.json({ error: 'Could not record purchase.' }, { status: 500 });
  }

  return Response.json({ received: true });
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
    const { data } = await admin.from('archive_subscriptions')
      .select('user_id').eq('stripe_subscription_id', sub.id).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) {
    console.error('subscription event with no known user', sub.id);
    return true; // Nothing we can attach it to; retrying won't help.
  }

  // Newer Stripe API versions moved the period end onto the subscription item.
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const { error } = await admin.from('archive_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) { console.error('failed to save subscription:', error); return false; }
  return true;
}
