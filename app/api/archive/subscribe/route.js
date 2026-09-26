import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured, archiveLineItem } from '@/lib/stripe';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Start a Stripe Checkout session for the monthly Campus Archive subscription. */
export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });

  const lineItem = archiveLineItem();
  if (!stripeConfigured() || !lineItem) {
    return Response.json(
      { error: 'The Campus Archive subscription is not set up on this site yet.' },
      { status: 503 }
    );
  }

  const admin = supabaseAdmin();
  const { data: existing } = await admin.from('archive_subscriptions')
    .select('status, current_period_end, stripe_customer_id').eq('user_id', user.id).maybeSingle();
  const active = existing && ['active', 'trialing'].includes(existing.status)
    && (!existing.current_period_end || new Date(existing.current_period_end) > new Date());
  if (active) {
    return Response.json({ error: 'You already have an active subscription.', alreadySubscribed: true }, { status: 400 });
  }

  // Optionally return the user to the deck they were looking at.
  let body = {};
  try { body = await request.json(); } catch {}
  const back = body.deckId && UUID.test(body.deckId) ? `/archive/${body.deckId}` : '/archive';
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    const session = await stripe().checkout.sessions.create({
      ui_mode: 'hosted_page',
      mode: 'subscription',
      line_items: [lineItem],
      // The webhook trusts ONLY this metadata, never anything the client sends.
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: user.email }),
      success_url: `${site}${back}?subscribed=1`,
      cancel_url: `${site}${back}`,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      payment_method_collection: 'always',
      submit_type: 'auto',
      integration_identifier: 'hosted_web_0001',
      origin_context: 'web',
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error('subscribe error:', err);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
