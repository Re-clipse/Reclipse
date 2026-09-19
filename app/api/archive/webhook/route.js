import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured } from '@/lib/stripe';

// Stripe needs the raw, unparsed body to verify its signature.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The ONLY place a purchase is ever recorded. Access is granted here, after
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

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return Response.json({ received: true, note: 'not paid' });
  }

  const deckId = session.metadata?.deck_id;
  const buyerId = session.metadata?.buyer_user_id;
  if (!deckId || !buyerId) {
    console.error('webhook missing metadata', session.id);
    return Response.json({ received: true, note: 'missing metadata' });
  }

  const admin = supabaseAdmin();
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
