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

/**
 * The date, weekday, and hour it currently is in an IANA timezone — used
 * server-side (app/api/send-reminders) where there's no browser Date to lean
 * on, and the server's own UTC "today" is often not the student's.
 */
export function localToday(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
      hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      weekday: get('weekday'),
      hour: Number(get('hour')),
    };
  } catch {
    const d = new Date();
    return {
      date: d.toISOString().slice(0, 10),
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()],
      hour: d.getUTCHours(),
    };
  }
}
