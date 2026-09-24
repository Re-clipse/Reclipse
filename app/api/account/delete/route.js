import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, stripeConfigured } from '@/lib/stripe';

/** Permanently deletes the caller's own account and everything tied to it. */
export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });

  const admin = supabaseAdmin();

  // Cancel any active Stripe subscription first — deleting the account
  // shouldn't leave something still billing a person who no longer has access.
  if (stripeConfigured()) {
    const { data: sub } = await admin.from('archive_subscriptions')
      .select('stripe_subscription_id').eq('user_id', user.id).maybeSingle();
    if (sub?.stripe_subscription_id) {
      try {
        await stripe().subscriptions.cancel(sub.stripe_subscription_id);
      } catch (err) {
        // Don't block deletion on this — an already-cancelled or missing
        // subscription on Stripe's side shouldn't stop someone from leaving.
        console.error('account delete: could not cancel Stripe subscription:', err.message);
      }
    }
  }

  // Deletes the auth.users row, which cascades through every table in the
  // schema via ON DELETE CASCADE — decks, flashcards, quiz data, progress,
  // course events, study plans, the profile row, referral records, and the
  // subscription record. (See supabase/009_fix_referred_by_on_delete.sql for
  // the one FK that needed fixing before this could cascade cleanly.)
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('account delete error:', error);
    return Response.json(
      { error: 'Could not delete your account. Please try again or contact support.' },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
