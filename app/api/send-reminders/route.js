import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SITE_URL, escapeHtml, sendEmail } from '@/lib/email';

// Called on a schedule (see vercel.json) — not by any page in the app. Sends
// four kinds of email, each with its own "already sent" guard so a daily
// cron run never duplicates anything:
//   1. Exam/quiz/lab/assignment reminders — course_events.reminder_sent_at
//   2. Study-session-day reminders        — study_plan_sessions.reminder_sent_at
//   3. Weekly digest (Sundays)            — profiles.last_digest_sent_at
//   4. Streak-loss warning                — profiles.last_streak_warning_sent_at
// Uses the admin client deliberately: a cron job isn't "someone", so RLS
// can't be the authorization boundary — the WHERE clauses (and the per-user
// email prefs below) are.
const TYPE_LABEL = { exam: 'Exam', quiz: 'Quiz', lab: 'Lab', assignment: 'Assignment', other: 'Date' };

const DEFAULT_PROFILE = {
  timezone: 'UTC',
  reminder_days_ahead: 3,
  remind_study_sessions: true,
  remind_weekly_digest: true,
  emails_enabled: true,
  last_digest_sent_at: null,
  last_streak_warning_sent_at: null,
};

export async function GET(request) {
  // Fail closed: an unset CRON_SECRET must block every request, not skip the
  // check — this route admin-sends email to every user, bypassing RLS.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  const given = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: profileRows } = await admin.from('profiles').select('*');
  const profiles = new Map((profileRows || []).map((p) => [p.user_id, { ...DEFAULT_PROFILE, ...p }]));
  const profileFor = (userId) => profiles.get(userId) || DEFAULT_PROFILE;

  const examSent = await sendExamReminders(admin, profileFor);
  const sessionSent = await sendStudySessionReminders(admin, profileFor);
  const streakDates = await fetchRecentSessionDates(admin);
  const digestSent = await sendWeeklyDigests(admin, profiles, streakDates);
  const streakSent = await sendStreakLossWarnings(admin, profiles, streakDates);

  return Response.json({
    examReminders: examSent, studySessionReminders: sessionSent,
    weeklyDigests: digestSent, streakWarnings: streakSent,
  });
}

// ---------- 1. Exam/quiz/lab/assignment reminders ----------
async function sendExamReminders(admin, profileFor) {
  const MAX_WINDOW_DAYS = 7; // the widest of the three reminder_days_ahead choices

  // A student's local "today" can be a day ahead of or behind server UTC, so
  // the SQL-level bounds must be a superset of every timezone's true window
  // — the same approach as sendStudySessionReminders below. The per-user
  // daysOut check (and the daysOut < 0 guard) is what actually decides.
  const windowStart = new Date(); windowStart.setDate(windowStart.getDate() - 1);
  const windowEnd = new Date(); windowEnd.setDate(windowEnd.getDate() + MAX_WINDOW_DAYS + 1);

  const { data: events } = await admin
    .from('course_events')
    .select('id, title, event_date, event_type, user_id, course_id, courses(name, remind_enabled)')
    .is('reminder_sent_at', null)
    .lte('event_date', windowEnd.toISOString().slice(0, 10))
    .gte('event_date', windowStart.toISOString().slice(0, 10));

  let sent = 0;
  const sentIds = [];
  for (const ev of events || []) {
    if (!ev.courses?.remind_enabled) continue;
    const profile = profileFor(ev.user_id);
    if (!profile.emails_enabled) continue;

    const { date: today } = localToday(profile.timezone);
    const daysOut = Math.round((new Date(`${ev.event_date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
    if (daysOut < 0 || daysOut > profile.reminder_days_ahead) continue;

    const email = await getEmail(admin, ev.user_id);
    if (!email) continue;

    const when = daysOut <= 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `in ${daysOut} days`;
    const ok = await sendEmail(ev.user_id, email, {
      subject: `${ev.courses?.name || 'A course'}: ${ev.title} is ${when}`,
      html: `
        <p>Hey, just a heads up:</p>
        <p><strong>${escapeHtml(ev.title)}</strong> (${escapeHtml(ev.event_type)}) for <strong>${escapeHtml(ev.courses?.name) || 'your course'}</strong>
        is ${when} (${ev.event_date}).</p>
        <p>Might be a good time to review your decks for it.</p>
        <p><a href="${SITE_URL}/decks">Open Reclipse</a></p>
        <p style="color:#888;font-size:13px;margin-top:24px;">
          Don't see this in your main inbox? Check your spam/junk folder.
          Reminder emails sometimes land there.
        </p>
      `,
    });
    if (ok) { sentIds.push(ev.id); sent += 1; }
  }
  // One batched update instead of one write per send — scales with reminders
  // sent per run rather than growing linearly forever.
  if (sentIds.length) {
    await admin.from('course_events').update({ reminder_sent_at: new Date().toISOString() }).in('id', sentIds);
  }
  return sent;
}

// ---------- 2. Study-session-day reminders ----------
async function sendStudySessionReminders(admin, profileFor) {
  // Plain `date` columns have no timezone of their own, so pull a superset
  // covering every timezone (UTC-12 to UTC+14) and check each row's actual
  // local date below, rather than trusting the DB-side date comparison.
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: sessions } = await admin
    .from('study_plan_sessions')
    .select(`
      id, user_id, session_date, tip, deck_id,
      course_events(title, event_type, courses(name)),
      decks(title)
    `)
    .is('reminder_sent_at', null)
    .eq('status', 'pending')
    .gte('session_date', yesterday.toISOString().slice(0, 10))
    .lte('session_date', tomorrow.toISOString().slice(0, 10));

  let sent = 0;
  const sentIds = [];
  for (const s of sessions || []) {
    const profile = profileFor(s.user_id);
    if (!profile.emails_enabled || !profile.remind_study_sessions) continue;

    const { date: localDate } = localToday(profile.timezone);
    if (s.session_date !== localDate) continue; // not actually "today" for this student yet

    const email = await getEmail(admin, s.user_id);
    if (!email) continue;

    const examTitle = escapeHtml(s.course_events?.title) || 'your exam';
    const courseName = escapeHtml(s.course_events?.courses?.name);
    const ok = await sendEmail(s.user_id, email, {
      subject: `Today's study session: ${s.course_events?.title || 'your exam'}`,
      html: `
        <p>Today's a planned study session ahead of <strong>${examTitle}</strong>${courseName ? ` (${courseName})` : ''}.</p>
        ${s.decks?.title ? `<p>Deck: <strong>${escapeHtml(s.decks.title)}</strong></p>` : ''}
        ${s.tip ? `<p>${escapeHtml(s.tip)}</p>` : ''}
        <p><a href="${SITE_URL}/calendar">Open your calendar</a></p>
      `,
    });
    if (ok) { sentIds.push(s.id); sent += 1; }
  }
  if (sentIds.length) {
    await admin.from('study_plan_sessions').update({ reminder_sent_at: new Date().toISOString() }).in('id', sentIds);
  }
  return sent;
}

// ---------- shared: recent study_sessions dates, for streak content ----------
// A plain per-user Set of "days studied" (last 60 days is enough for any
// streak a warning or digest line would realistically mention) computed once
// and shared by the digest and the streak-loss warning below, rather than
// two separate full-table scans.
async function fetchRecentSessionDates(admin) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
  const { data: sessions } = await admin
    .from('study_sessions')
    .select('user_id, created_at')
    .gte('created_at', cutoff.toISOString());

  const byUser = new Map();
  for (const s of sessions || []) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, new Set());
    byUser.get(s.user_id).add(new Date(s.created_at).toISOString().slice(0, 10));
  }
  return byUser;
}

// Consecutive days studied ending at (and including) dateStr, going backward.
function streakEndingAt(days, dateStr) {
  if (!days?.has(dateStr)) return 0;
  let streak = 0;
  const cursor = new Date(`${dateStr}T00:00:00Z`);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// ---------- 3. Weekly digest (Sundays, per the student's own timezone) ----------
async function sendWeeklyDigests(admin, profiles, streakDates) {
  const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 7);
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: upcomingEvents } = await admin
    .from('course_events')
    .select('user_id, title, event_date, event_type, courses(name)')
    .gte('event_date', todayIso)
    .lte('event_date', weekAhead.toISOString().slice(0, 10));

  const { data: upcomingSessions } = await admin
    .from('study_plan_sessions')
    .select('user_id, session_date, tip, course_events(title)')
    .eq('status', 'pending')
    .gte('session_date', todayIso)
    .lte('session_date', weekAhead.toISOString().slice(0, 10));

  // Only users who actually have something upcoming are candidates — anyone
  // else would just get an empty digest, which we skip rather than send.
  const candidateIds = new Set([
    ...(upcomingEvents || []).map((e) => e.user_id),
    ...(upcomingSessions || []).map((s) => s.user_id),
  ]);

  let sent = 0;
  for (const userId of candidateIds) {
    const profile = profiles.get(userId) || DEFAULT_PROFILE;
    if (!profile.emails_enabled || !profile.remind_weekly_digest) continue;

    const { date: localDate, weekday } = localToday(profile.timezone);
    if (weekday !== 'Sun') continue;
    if (profile.last_digest_sent_at) {
      const sinceLast = Date.now() - new Date(profile.last_digest_sent_at).getTime();
      if (sinceLast < 6 * 86400000) continue; // already sent this week
    }

    const events = (upcomingEvents || []).filter((e) => e.user_id === userId)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    const sessions = (upcomingSessions || []).filter((s) => s.user_id === userId)
      .sort((a, b) => a.session_date.localeCompare(b.session_date));
    if (!events.length && !sessions.length) continue;

    const email = await getEmail(admin, userId);
    if (!email) continue;

    // Streak is a bonus line, not a reason to send or skip the digest — it
    // only ever adds to a digest already going out for real upcoming dates.
    const streak = streakEndingAt(streakDates.get(userId), localDate)
      || streakEndingAt(streakDates.get(userId), shiftDate(localDate, -1));

    const eventsHtml = events.map((e) =>
      `<li><strong>${escapeHtml(e.title)}</strong> (${escapeHtml(TYPE_LABEL[e.event_type] || e.event_type)}${e.courses?.name ? `, ${escapeHtml(e.courses.name)}` : ''}) — ${e.event_date}</li>`
    ).join('');
    const sessionsHtml = sessions.map((s) =>
      `<li>${s.session_date}: ${s.tip ? escapeHtml(s.tip) : `Study session for ${escapeHtml(s.course_events?.title) || 'an upcoming exam'}`}</li>`
    ).join('');

    const ok = await sendEmail(userId, email, {
      subject: 'Your week ahead on Reclipse',
      html: `
        ${streak >= 2 ? `<p>You're on a <strong>${streak}-day study streak</strong>. Keep it up this week.</p>` : ''}
        <p>Here's what's coming up this week:</p>
        ${events.length ? `<p><strong>Deadlines</strong></p><ul>${eventsHtml}</ul>` : ''}
        ${sessions.length ? `<p><strong>Planned study sessions</strong></p><ul>${sessionsHtml}</ul>` : ''}
        <p><a href="${SITE_URL}/calendar">Open your calendar</a></p>
      `,
    });
    if (ok) {
      await admin.from('profiles').upsert(
        { user_id: userId, last_digest_sent_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      sent += 1;
    }
  }
  return sent;
}

// ---------- 4. Streak-loss warning ----------
// Fires only for a student whose streak is already at least 2 days, who
// hasn't studied yet today, and for whom it's currently evening in their own
// timezone — this cron runs once a day (see vercel.json), so in practice
// that window only lands for students whose timezone puts evening around the
// cron's fixed UTC run time; students elsewhere simply won't get this email
// under the current single daily run.
async function sendStreakLossWarnings(admin, profiles, streakDates) {
  let sent = 0;
  for (const [userId, days] of streakDates) {
    const profile = profiles.get(userId) || DEFAULT_PROFILE;
    if (!profile.emails_enabled || !profile.remind_study_sessions) continue;

    const { date: localDate, hour } = localToday(profile.timezone);
    if (hour < 18 || hour > 22) continue; // only during the student's evening
    if (days.has(localDate)) continue; // already studied today — streak safe

    const streak = streakEndingAt(days, shiftDate(localDate, -1));
    if (streak < 2) continue; // no real streak at risk yet

    if (profile.last_streak_warning_sent_at) {
      const sinceLast = Date.now() - new Date(profile.last_streak_warning_sent_at).getTime();
      if (sinceLast < 20 * 3600000) continue; // already warned today
    }

    const email = await getEmail(admin, userId);
    if (!email) continue;

    const ok = await sendEmail(userId, email, {
      subject: `Your ${streak}-day streak breaks tonight`,
      html: `
        <p>You've studied ${streak} days in a row on Reclipse.</p>
        <p>You haven't logged a session yet today — review a few cards before the day ends to keep it going.</p>
        <p><a href="${SITE_URL}/decks">Study now</a></p>
      `,
    });
    if (ok) {
      await admin.from('profiles').upsert(
        { user_id: userId, last_streak_warning_sent_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      sent += 1;
    }
  }
  return sent;
}

// ---------- shared helpers ----------
function localToday(timeZone) {
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

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

const emailCache = new Map();
async function getEmail(admin, userId) {
  if (emailCache.has(userId)) return emailCache.get(userId);
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data?.user?.email || null;
  emailCache.set(userId, email);
  return email;
}
