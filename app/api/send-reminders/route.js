import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Called on a schedule (see vercel.json) — not by any page in the app. Finds
// opted-in course events happening in the next 2 days that haven't been
// emailed yet, sends one email per event, marks it sent so it's never
// duplicated. Uses the admin client deliberately: this has no logged-in user
// (a cron job isn't "someone"), so RLS can't be the authorization boundary —
// the WHERE clauses below are.
const REMINDER_WINDOW_DAYS = 2;
const FROM = 'Reclipse <onboarding@resend.dev>';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) {
    return Response.json({ error: 'Reminders are not configured.' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + REMINDER_WINDOW_DAYS);

  const { data: events, error } = await admin
    .from('course_events')
    .select('id, title, event_date, event_type, user_id, course_id, courses(name, remind_enabled)')
    .is('reminder_sent_at', null)
    .lte('event_date', windowEnd.toISOString().slice(0, 10))
    .gte('event_date', new Date().toISOString().slice(0, 10));

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const due = (events || []).filter((e) => e.courses?.remind_enabled);
  if (!due.length) return Response.json({ sent: 0 });

  let sent = 0;
  for (const ev of due) {
    const { data: userRes } = await admin.auth.admin.getUserById(ev.user_id);
    const email = userRes?.user?.email;
    if (!email) continue;

    const daysOut = Math.round((new Date(ev.event_date) - new Date()) / 86400000);
    const when = daysOut <= 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `in ${daysOut} days`;

    const ok = await sendReminderEmail(email, ev, when);
    if (ok) {
      await admin.from('course_events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', ev.id);
      sent += 1;
    }
  }

  return Response.json({ sent, checked: due.length });
}

async function sendReminderEmail(to, ev, when) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: `${ev.courses?.name || 'A course'}: ${ev.title} is ${when}`,
        html: `
          <p>Hey \u2014 just a heads up:</p>
          <p><strong>${ev.title}</strong> (${ev.event_type}) for <strong>${ev.courses?.name || 'your course'}</strong>
          is ${when} (${ev.event_date}).</p>
          <p>Might be a good time to review your decks for it.</p>
          <p><a href="https://reclipsed.netlify.app/decks">Open Reclipse</a></p>
          <p style="color:#888;font-size:13px;margin-top:24px;">
            Don't see this in your main inbox? Check your spam/junk folder \u2014
            reminder emails sometimes land there.
          </p>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
