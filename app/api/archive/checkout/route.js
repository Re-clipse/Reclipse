import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured } from '@/lib/stripe';

/** Start a Stripe Checkout session to unlock an archived deck. */
export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });

  if (!stripeConfigured()) {
    return Response.json(
      { error: 'Payments are not set up on this site yet, so archive decks cannot be purchased.' },
      { status: 503 }
    );
  }

  const { deckId } = await request.json();
  if (!deckId) return Response.json({ error: 'Missing deck.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: deck } = await admin
    .from('decks')
    .select('id, title, user_id, is_archived, archive_price_cents, course_label')
    .eq('id', deckId).maybeSingle();

  if (!deck || !deck.is_archived || !deck.archive_price_cents) {
    return Response.json({ error: 'This deck is not for sale.' }, { status: 404 });
  }
  if (deck.user_id === user.id) {
    return Response.json({ error: "This is your own deck — you already have access." }, { status: 400 });
  }

  // Don't let someone pay twice for the same deck.
  const { data: existing } = await admin.from('deck_purchases')
    .select('id').eq('deck_id', deckId).eq('buyer_user_id', user.id).maybeSingle();
  if (existing) {
    return Response.json({ error: 'You already own this deck.', alreadyOwned: true }, { status: 400 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'cad',
          unit_amount: deck.archive_price_cents,
          product_data: {
            name: deck.title,
            description: deck.course_label ? `Campus Archive deck — ${deck.course_label}` : 'Campus Archive deck',
          },
        },
      }],
      // The webhook trusts ONLY this metadata, never anything the client sends.
      metadata: { deck_id: deck.id, buyer_user_id: user.id },
      success_url: `${site}/archive/${deck.id}?purchased=1`,
      cancel_url: `${site}/archive/${deck.id}`,
      customer_email: user.email,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
