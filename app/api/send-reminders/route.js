import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { signUnsubscribeToken } from '@/lib/emailToken';

// Called on a schedule (see vercel.json) — not by any page in the app. Sends
// three kinds of email, each with its own "already sent" guard so a daily
// cron run never duplicates anything:
//   1. Exam/quiz/lab/assignment reminders — course_events.reminder_sent_at
//   2. Study-session-day reminders        — study_plan_sessions.reminder_sent_at
//   3. Weekly digest (Sundays)            — profiles.last_digest_sent_at
// Uses the admin client deliberately: a cron job isn't "someone", so RLS
// can't be the authorization boundary — the WHERE clauses (and the per-user
// email prefs below) are.
// reclipsed.netlify.app is a separate marketing page, deliberately left out of
// sync with the app (see REDESIGN_LOG.md) — never a safe fallback for links
// inside a reminder email. Falling back to the same localhost default
// .env.example uses means a missing env var breaks obviously in dev instead
// of silently sending students to the wrong site in production.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const FROM = 'Reclipse <onboarding@resend.dev>';
const TYPE_LABEL = { exam: 'Exam', quiz: 'Quiz', lab: 'Lab', assignment: 'Assignment', other: 'Date' };

const DEFAULT_PROFILE = {
  timezone: 'UTC',
  reminder_days_ahead: 3,
  remind_study_sessions: true,
  remind_weekly_digest: true,
  emails_enabled: true,
  last_digest_sent_at: null,
};

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: profileRows } = await admin.from('profiles').select('*');
  const profiles = new Map((profileRows || []).map((p) => [p.user_id, { ...DEFAULT_PROFILE, ...p }]));
  const profileFor = (userId) => profiles.get(userId) || DEFAULT_PROFILE;

  const examSent = await sendExamReminders(admin, profileFor);
  const sessionSent = await sendStudySessionReminders(admin, profileFor);
  const digestSent = await sendWeeklyDigests(admin, profiles);

  return Response.json({ examReminders: examSent, studySessionReminders: sessionSent, weeklyDigests: digestSent });
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
    if (ok) {
      await admin.from('course_events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', ev.id);
      sent += 1;
    }
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
    if (ok) {
      await admin.from('study_plan_sessions').update({ reminder_sent_at: new Date().toISOString() }).eq('id', s.id);
      sent += 1;
    }
  }
  return sent;
}

// ---------- 3. Weekly digest (Sundays, per the student's own timezone) ----------
async function sendWeeklyDigests(admin, profiles) {
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

    const { weekday } = localToday(profile.timezone);
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

    const eventsHtml = events.map((e) =>
      `<li><strong>${escapeHtml(e.title)}</strong> (${escapeHtml(TYPE_LABEL[e.event_type] || e.event_type)}${e.courses?.name ? `, ${escapeHtml(e.courses.name)}` : ''}) — ${e.event_date}</li>`
    ).join('');
    const sessionsHtml = sessions.map((s) =>
      `<li>${s.session_date}: ${s.tip ? escapeHtml(s.tip) : `Study session for ${escapeHtml(s.course_events?.title) || 'an upcoming exam'}`}</li>`
    ).join('');

    const ok = await sendEmail(userId, email, {
      subject: 'Your week ahead on Reclipse',
      html: `
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

// ---------- shared helpers ----------
// Course/event/deck titles are student-editable text (syllabus AI extraction,
// or typed directly via the calendar's edit modal) that lands straight into
// an HTML email body below. Nothing else in this codebase renders raw HTML
// from user input, but a template literal like this has no equivalent to
// React's automatic escaping, so it needs its own.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function localToday(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: get('weekday') };
  } catch {
    const d = new Date();
    return { date: d.toISOString().slice(0, 10), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] };
  }
}

const emailCache = new Map();
async function getEmail(admin, userId) {
  if (emailCache.has(userId)) return emailCache.get(userId);
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data?.user?.email || null;
  emailCache.set(userId, email);
  return email;
}

async function sendEmail(userId, to, { subject, html }) {
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${signUnsubscribeToken(userId)}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html: `
          ${html}
          <p style="color:#888;font-size:12px;margin-top:24px;">
            <a href="${unsubscribeUrl}" style="color:#888;">Unsubscribe from these emails</a>
          </p>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
