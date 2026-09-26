-- Migration 019 — Recurring weekly lab reminders.
--
-- Syllabus upload (003/parse-syllabus) only catches dated deadlines (exams,
-- quizzes, assignments) — labs are usually listed as "every Tuesday 2pm"
-- rather than a specific date, so today students get zero reminders for
-- them. This adds a lightweight recurring-rule table instead of one
-- course_events row per week: occurrences are computed at read time
-- (lib/labSchedule.js), used by both the calendar page and send-reminders,
-- not pre-materialized into rows.
--
-- No term-end-date is stored anywhere else in the schema (courses/
-- course_events have none) to inherit from, so ends_on is required here —
-- the lab form always asks for it.

create table if not exists lab_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_code text not null,
  course_name text,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday, matches JS Date#getDay()
  time text, -- 'HH:MM', nullable when no specific time is known
  ends_on date not null,
  active boolean not null default true,
  -- The occurrence date (not a timestamp) we last emailed a reminder for —
  -- a recurring rule needs "did we already remind for THIS week's
  -- occurrence", not a one-shot sent flag like course_events.reminder_sent_at.
  last_reminder_sent_on date,
  created_at timestamptz default now()
);
create index if not exists lab_schedules_user_idx on lab_schedules (user_id);

alter table lab_schedules enable row level security;
drop policy if exists "own lab schedules" on lab_schedules;
create policy "own lab schedules" on lab_schedules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One-shot "have they seen the /calendar walkthrough" flag — same shape as
-- other one-time profile flags in this codebase (e.g. profiles.onboarded_at).
alter table profiles add column if not exists lab_walkthrough_seen boolean not null default false;
