/**
 * SM-2 spaced repetition.
 *
 * rating: 0 = blackout, 1 = hard, 2 = good, 3 = easy
 * Anything below 2 counts as a lapse and resets the interval.
 */
export function schedule(prev, rating) {
  const cur = prev || { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
  let { ease, interval_days: interval, reps, lapses } = cur;

  if (rating < 2) {
    reps = 0;
    lapses += 1;
    interval = 0;            // back in this session
    ease = Math.max(1.3, ease - 0.2);
  } else {
    // SM-2 ease adjustment, mapped from our 0-3 scale onto the classic 0-5.
    const q = rating === 2 ? 4 : 5;
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ease);
    if (rating === 3) interval = Math.round(interval * 1.3);
  }

  const due = new Date();
  if (interval >= 1) due.setDate(due.getDate() + interval);
  else due.setMinutes(due.getMinutes() + 10); // relearn shortly

  return {
    ease: Number(ease.toFixed(2)),
    interval_days: interval,
    reps,
    lapses,
    due_at: due.toISOString(),
    last_rating: rating,
    updated_at: new Date().toISOString(),
  };
}

/** Human-readable "next review" hint shown on the grading buttons. */
export function previewInterval(prev, rating) {
  const { interval_days } = schedule(prev, rating);
  if (interval_days < 1) return '<10m';
  if (interval_days === 1) return '1d';
  if (interval_days < 30) return `${interval_days}d`;
  if (interval_days < 365) return `${Math.round(interval_days / 30)}mo`;
  return `${(interval_days / 365).toFixed(1)}y`;
}
