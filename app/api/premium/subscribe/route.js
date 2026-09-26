import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured, premiumLineItem } from '@/lib/stripe';

/** Start a Stripe Checkout session for the Reclipse Plus subscription. */
export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });

  let body = {};
  try { body = await request.json(); } catch {}
  const interval = body.interval === 'year' ? 'year' : 'month';

  const lineItem = premiumLineItem(interval);
  if (!stripeConfigured() || !lineItem) {
    return Response.json(
      { error: 'Reclipse Plus is not set up on this site yet.' },
      { status: 503 }
    );
  }

  const admin = supabaseAdmin();
  const { data: existing } = await admin.from('premium_subscriptions')
    .select('status, current_period_end, stripe_customer_id').eq('user_id', user.id).maybeSingle();
  const active = existing && ['active', 'trialing'].includes(existing.status)
    && (!existing.current_period_end || new Date(existing.current_period_end) > new Date());
  if (active) {
    return Response.json({ error: 'You already have an active subscription.', alreadySubscribed: true }, { status: 400 });
  }

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
      success_url: `${site}/settings?premium=1`,
      cancel_url: `${site}/settings`,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false },
      // Off while revenue stays under the CRA's $30k/yr small-supplier
      // threshold — see STRIPE_INTEGRATION_TODO.md.
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      payment_method_collection: 'always',
      submit_type: 'auto',
      integration_identifier: 'hosted_web_0001',
      origin_context: 'web',
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error('premium subscribe error:', err);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
