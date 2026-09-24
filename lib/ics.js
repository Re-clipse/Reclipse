// Minimal RFC5545 .ics builder for all-day events (course_events and
// study_plan_sessions are plain dates with no time of day). No calendar
// library — this is a handful of text lines.

function escapeText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function dateStamp(d) {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function ymd(dateStr) {
  return dateStr.replace(/-/g, '');
}

function addOneDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** events: [{ id, title, date: 'YYYY-MM-DD', description? }] */
export function buildIcs(events, { calendarName = 'Reclipse' } = {}) {
  const now = dateStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Reclipse//Calendar//EN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@reclipse`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${ymd(ev.date)}`,
      `DTEND;VALUE=DATE:${ymd(addOneDay(ev.date))}`,
      `SUMMARY:${escapeText(ev.title)}`,
      ...(ev.description ? [`DESCRIPTION:${escapeText(ev.description)}`] : []),
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(events, filename = 'reclipse-calendar.ics') {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
