// Shared by both client (lib/premium.js) and server routes — no supabase
// import here on purpose, so server code can use it without pulling in the
// browser client.

/**
 * True during the global launch-week trial, when every signed-in user gets
 * premium for free — a single site-wide date, not per-user data.
 *
 * Unset = the trial hasn't been scheduled yet (e.g. before real launch, or
 * before checkout exists), so this treats everyone as still covered rather
 * than enforcing the tighter post-trial limits with no way to actually pay.
 * Once NEXT_PUBLIC_PREMIUM_TRIAL_ENDS_AT is set, the trial ends for real at
 * that date — no code change needed.
 */
export function isLaunchTrialActive() {
  const endsAt = process.env.NEXT_PUBLIC_PREMIUM_TRIAL_ENDS_AT;
  if (!endsAt) return true;
  return Date.now() < Date.parse(endsAt);
}
