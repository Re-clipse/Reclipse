import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured } from '@/lib/stripe';

/** Open Stripe's billing portal so a subscriber can cancel or update their card. */
export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });
  if (!stripeConfigured()) return Response.json({ error: 'Payments are not set up yet.' }, { status: 503 });

  const { data: sub } = await supabaseAdmin().from('archive_subscriptions')
    .select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!sub?.stripe_customer_id) return Response.json({ error: 'No subscription found.' }, { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${site}/archive`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error('portal error:', err);
    return Response.json({ error: 'Could not open billing settings.' }, { status: 500 });
  }
}
