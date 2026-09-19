-- Migration 003 — syllabus reminders, campus popular, collaborative decks.

-- ---------- Syllabus-derived dates + opt-in reminders ----------
alter table courses add column if not exists remind_enabled boolean not null default false;

create table if not exists course_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  event_date date not null,
  event_type text default 'other', -- exam | quiz | lab | assignment | other
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists course_events_date_idx on course_events (event_date);

alter table course_events enable row level security;
drop policy if exists "own course events" on course_events;
create policy "own course events" on course_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Campus popular (anonymous aggregation over shared decks only) ----------
-- Snapshot of the course name at share-time, since courses are per-user and
-- can't otherwise be grouped across accounts.
alter table decks add column if not exists course_label text;

-- security definer: intentionally bypasses RLS, but only ever returns
-- already-public deck titles + an aggregate count. No user identity, no
-- private deck data, no raw session rows — that's the whole privacy boundary.
create or replace function public.popular_decks(p_course text default null, p_limit int default 20)
returns table(id uuid, title text, course_label text, share_id text, activity bigint)
language sql security definer set search_path = public as $$
  select d.id, d.title, d.course_label, d.share_id,
    (coalesce((select count(*) from study_sessions s where s.deck_id = d.id), 0)
     + coalesce((select count(*) from quiz_responses q where q.deck_id = d.id), 0)) as activity
  from decks d
  where d.is_public = true
    and (p_course is null or d.course_label ilike '%' || p_course || '%')
  order by activity desc, d.created_at desc
  limit p_limit;
$$;
grant execute on function public.popular_decks(text, int) to anon, authenticated;

-- ---------- Collaborative decks ----------
alter table decks add column if not exists collab_enabled boolean not null default false;
alter table decks add column if not exists collab_id text unique;

create table if not exists deck_collaborators (
  deck_id uuid references decks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  added_at timestamptz default now(),
  primary key (deck_id, user_id)
);

alter table deck_collaborators enable row level security;

drop policy if exists "see own collaboration or your deck's collaborators" on deck_collaborators;
create policy "see own collaboration or your deck's collaborators" on deck_collaborators
  for select using (
    user_id = auth.uid()
    or deck_id in (select id from decks where user_id = auth.uid())
  );

-- Joining happens through /api/join-collab using the service role key (so a
-- risky broad "anyone can read collab-enabled decks" RLS policy is never
-- needed). Owners can still remove a collaborator directly from deck settings.
drop policy if exists "owner removes collaborators" on deck_collaborators;
create policy "owner removes collaborators" on deck_collaborators
  for delete using (deck_id in (select id from decks where user_id = auth.uid()));

-- Collaborators can see the deck itself...
drop policy if exists "collaborators can view their decks" on decks;
create policy "collaborators can view their decks" on decks for select
  using (id in (select deck_id from deck_collaborators where user_id = auth.uid()));

-- ...and can add/edit/delete its flashcards (the actual "add cards together" ask).
-- Deliberately scoped to flashcards only, not quiz_questions or deck settings.
drop policy if exists "collaborators manage flashcards" on flashcards;
create policy "collaborators manage flashcards" on flashcards for all
  using (
    deck_id in (
      select dc.deck_id from deck_collaborators dc
      join decks d on d.id = dc.deck_id
      where dc.user_id = auth.uid() and d.collab_enabled = true
    )
  )
  with check (
    deck_id in (
      select dc.deck_id from deck_collaborators dc
      join decks d on d.id = dc.deck_id
      where dc.user_id = auth.uid() and d.collab_enabled = true
    )
  );
