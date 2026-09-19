-- Reclipse migration 002 — courses, sharing, spaced repetition, stats, profiles.
-- Safe to re-run: everything is IF NOT EXISTS / idempotent.

-- ---------- Profiles (display name + onboarding state) ----------
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  school text,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- Courses (folders for decks) ----------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  code text,
  color text default 'violet',
  created_at timestamptz default now()
);

-- ---------- Deck additions ----------
alter table decks add column if not exists course_id uuid references courses(id) on delete set null;
alter table decks add column if not exists summary text;
alter table decks add column if not exists share_id text unique;
alter table decks add column if not exists is_public boolean not null default false;
alter table decks add column if not exists copied_from uuid references decks(id) on delete set null;
alter table decks add column if not exists difficulty text;

-- ---------- Flashcard additions ----------
-- card_type: 'basic' (Q/A) or 'cloze' (fill in the blank)
alter table flashcards add column if not exists card_type text not null default 'basic';
alter table flashcards add column if not exists position int;

-- ---------- Spaced repetition (SM-2 state, per user per card) ----------
create table if not exists card_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  flashcard_id uuid references flashcards(id) on delete cascade not null,
  ease real not null default 2.5,
  interval_days real not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  due_at timestamptz not null default now(),
  last_rating int,
  updated_at timestamptz default now(),
  primary key (user_id, flashcard_id)
);
create index if not exists card_progress_due_idx on card_progress (user_id, due_at);

-- ---------- Study sessions (streaks, history, stats) ----------
create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  deck_id uuid references decks(id) on delete set null,
  kind text not null default 'flashcards',   -- flashcards | quiz | exam
  reviewed int not null default 0,
  correct int not null default 0,
  duration_seconds int,
  created_at timestamptz default now()
);
create index if not exists study_sessions_user_idx on study_sessions (user_id, created_at desc);

-- ---------- Per-question responses (weak-spot detection) ----------
create table if not exists quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  question_id uuid references quiz_questions(id) on delete cascade not null,
  deck_id uuid references decks(id) on delete cascade,
  chosen_index int,
  correct boolean,
  created_at timestamptz default now()
);
create index if not exists quiz_responses_user_idx on quiz_responses (user_id, created_at desc);

-- ---------- RLS ----------
alter table profiles        enable row level security;
alter table courses         enable row level security;
alter table card_progress   enable row level security;
alter table study_sessions  enable row level security;
alter table quiz_responses  enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own courses" on courses;
create policy "own courses" on courses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own card progress" on card_progress;
create policy "own card progress" on card_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own sessions" on study_sessions;
create policy "own sessions" on study_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own responses" on quiz_responses;
create policy "own responses" on quiz_responses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Public deck sharing (additive read policies) ----------
drop policy if exists "public decks are readable" on decks;
create policy "public decks are readable" on decks for select using (is_public = true);

drop policy if exists "public deck cards are readable" on flashcards;
create policy "public deck cards are readable" on flashcards for select
  using (deck_id in (select id from decks where is_public = true));

drop policy if exists "public deck quiz is readable" on quiz_questions;
create policy "public deck quiz is readable" on quiz_questions for select
  using (deck_id in (select id from decks where is_public = true));
