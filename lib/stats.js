/** Consecutive-day streak from session timestamps (today or yesterday keeps it alive). */
export function streakFrom(dates) {
  if (!dates?.length) return 0;
  const days = new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)));
  const today = new Date();
  const key = (d) => d.toISOString().slice(0, 10);

  let cursor = new Date(today);
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(key(cursor))) return 0; // nothing today or yesterday
  }
  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Last n days as [{date, count}] for the activity strip. */
export function activityByDay(dates, n = 28) {
  const counts = new Map();
  for (const d of dates || []) {
    const k = new Date(d).toISOString().slice(0, 10);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    out.push({ date: k, count: counts.get(k) || 0 });
  }
  return out;
}

export function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
