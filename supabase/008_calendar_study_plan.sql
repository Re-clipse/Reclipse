-- Migration 008 — Calendar, study-plan recommendations, and the reminder
-- email settings that go with them (study-session days, weekly digest,
-- per-user lead time, and a no-login unsubscribe switch).

-- ---------- Per-user email/timezone preferences ----------
-- Dates in course_events/study_plan_sessions are plain `date` values with no
-- time zone of their own — "today" and "which Sunday" only mean something
-- once resolved against the student's own timezone, not the server's UTC.
alter table profiles add column if not exists timezone text not null default 'UTC';

-- How many days before an exam/quiz/lab the existing reminder fires.
-- Replaces the old hardcoded 2-day window in api/send-reminders. Constrained
-- to the three choices the Settings page offers.
alter table profiles add column if not exists reminder_days_ahead int not null default 3;
alter table profiles drop constraint if exists profiles_reminder_days_ahead_check;
alter table profiles add constraint profiles_reminder_days_ahead_check
  check (reminder_days_ahead in (1, 3, 7));

alter table profiles add column if not exists remind_study_sessions boolean not null default true;
alter table profiles add column if not exists remind_weekly_digest boolean not null default true;
-- Guard against double-sending the digest when the cron runs daily but the
-- digest should only go out once per week.
alter table profiles add column if not exists last_digest_sent_at timestamptz;

-- Master switch: the unsubscribe link in every reminder email sets this to
-- false without requiring login, per-type toggles above stay as-is so
-- turning things back on from Settings restores exactly what was on before.
alter table profiles add column if not exists emails_enabled boolean not null default true;

-- ---------- Study plan sessions ----------
-- One row per recommended study session leading up to an exam/quiz. Dates
-- come from a rule (lib/studyPlan.js), not the AI; deck_id is whichever of
-- the student's own decks for that course has the most weak/due cards.
-- Generated once per course_event (see app/api/study-plan/route.js), so
-- rows persist rather than being recomputed on every page view.
create table if not exists study_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_event_id uuid references course_events(id) on delete cascade not null,
  deck_id uuid references decks(id) on delete set null,
  session_date date not null,
  tip text,
  status text not null default 'pending', -- pending | done | skipped
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists study_plan_sessions_date_idx on study_plan_sessions (user_id, session_date);
create index if not exists study_plan_sessions_event_idx on study_plan_sessions (course_event_id);

alter table study_plan_sessions enable row level security;
drop policy if exists "own study plan sessions" on study_plan_sessions;
create policy "own study plan sessions" on study_plan_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
