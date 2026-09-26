// Pure date-math for recurring weekly lab reminders — no Supabase/network
// here, so it's directly unit-testable with a fixed clock.

/**
 * Next date (YYYY-MM-DD) on or after fromIso that falls on `weekday`
 * (0 = Sunday .. 6 = Saturday, matches JS Date#getDay()). Computed in UTC
 * throughout so date-only strings never shift a day depending on the
 * server's local offset — the same approach send-reminders/route.js uses
 * for shiftDate().
 */
export function nextOccurrenceOnOrAfter(weekday, fromIso) {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const diff = (weekday - from.getUTCDay() + 7) % 7;
  from.setUTCDate(from.getUTCDate() + diff);
  return from.toISOString().slice(0, 10);
}

/** Up to `limit` upcoming occurrence dates for a lab, bounded by lab.ends_on. */
export function upcomingLabOccurrences(lab, { from, limit = 8 } = {}) {
  const fromIso = from || new Date().toISOString().slice(0, 10);
  const out = [];
  let cursor = nextOccurrenceOnOrAfter(lab.weekday, fromIso);
  while (cursor <= lab.ends_on && out.length < limit) {
    out.push(cursor);
    const d = new Date(`${cursor}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    cursor = d.toISOString().slice(0, 10);
  }
  return out;
}

/**
 * Whether a lab reminder should fire for a student whose local "today" is
 * localDateStr. Fixed at "the day before", once per occurrence (tracked via
 * lab.last_reminder_sent_on) — unlike exam reminders, this isn't governed by
 * the student's configurable reminder_days_ahead setting.
 */
export function shouldSendLabReminder(lab, localDateStr) {
  if (!lab.active) return { send: false, occurrenceDate: null };
  const occurrenceDate = nextOccurrenceOnOrAfter(lab.weekday, localDateStr);
  if (occurrenceDate > lab.ends_on) return { send: false, occurrenceDate };
  if (lab.last_reminder_sent_on === occurrenceDate) return { send: false, occurrenceDate };
  const daysOut = Math.round((new Date(`${occurrenceDate}T00:00:00Z`) - new Date(`${localDateStr}T00:00:00Z`)) / 86400000);
  if (daysOut !== 1) return { send: false, occurrenceDate };
  return { send: true, occurrenceDate };
}
