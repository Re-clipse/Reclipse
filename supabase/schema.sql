-- Run this in the Supabase SQL editor.

create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  source_text text,
  created_at timestamptz default now()
);

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references decks(id) on delete cascade not null,
  question text not null,
  answer text not null,
  created_at timestamptz default now()
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references decks(id) on delete cascade not null,
  question text not null,
  options jsonb not null,       -- array of strings
  correct_index int not null,
  explanation text,
  created_at timestamptz default now()
);

-- Tracks how many study sets each user has generated today, so the API
-- route can enforce a daily cap (see app/api/generate/route.js).
create table if not exists usage_limits (
  user_id uuid references auth.users(id) on delete cascade not null,
  usage_date date not null default current_date,
  generations_count int not null default 0,
  primary key (user_id, usage_date)
);

alter table usage_limits enable row level security;

create policy "Users manage their own usage row"
  on usage_limits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Row-level security: users can only see their own decks/cards.
alter table decks enable row level security;
alter table flashcards enable row level security;
alter table quiz_questions enable row level security;

create policy "Users manage their own decks"
  on decks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage flashcards in their own decks"
  on flashcards for all
  using (deck_id in (select id from decks where user_id = auth.uid()))
  with check (deck_id in (select id from decks where user_id = auth.uid()));

create policy "Users manage quiz questions in their own decks"
  on quiz_questions for all
  using (deck_id in (select id from decks where user_id = auth.uid()))
  with check (deck_id in (select id from decks where user_id = auth.uid()));
