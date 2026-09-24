/**
 * Local YYYY-MM-DD for a Date. Never use toISOString() for this — it
 * converts to UTC first and can shift the calendar day depending on the
 * browser's timezone offset, which is exactly wrong for date-only fields
 * like course_events.event_date and study_plan_sessions.session_date.
 */
export function localIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
