-- Migration 006 — Campus Archive becomes a monthly subscription.
--
-- Before: each archived deck was sold individually (deck_purchases).
-- Now:    one subscription gives access to EVERY archived deck. Uploaders set no
--         price and earn nothing; non-subscribers only see the capped preview.
--
-- Legacy deck_purchases rows and their policies are left in place, so anyone who
-- already bought a deck keeps access to it.

-- ---------- Subscriptions ----------
create table if not exists archive_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null,                 -- Stripe status: active, trialing, past_due, canceled, ...
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

alter table archive_subscriptions enable row level security;

drop policy if exists "users see their own archive subscription" on archive_subscriptions;
create policy "users see their own archive subscription" on archive_subscriptions
  for select using (user_id = auth.uid());
-- No client write policies on purpose: rows are written only by the Stripe
-- webhook (service role) after Stripe's signature verifies the event.

-- ---------- Access helpers (SECURITY DEFINER to avoid RLS recursion, like 005) ----------
create or replace function public.has_archive_access()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from archive_subscriptions
    where user_id = auth.uid()
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

create or replace function public.is_archived_deck(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from decks where id = p_deck and is_archived = true);
$$;

grant execute on function public.has_archive_access()       to authenticated;
grant execute on function public.is_archived_deck(uuid)     to authenticated;

-- ---------- Subscribers can read archived decks, cards and quizzes ----------
drop policy if exists "subscribers view archived decks" on decks;
create policy "subscribers view archived decks" on decks
  for select using (is_archived = true and public.has_archive_access());

drop policy if exists "subscribers view archived flashcards" on flashcards;
create policy "subscribers view archived flashcards" on flashcards
  for select using (public.is_archived_deck(deck_id) and public.has_archive_access());

drop policy if exists "subscribers view archived quiz questions" on quiz_questions;
create policy "subscribers view archived quiz questions" on quiz_questions
  for select using (public.is_archived_deck(deck_id) and public.has_archive_access());

-- ---------- Listing + preview no longer involve a price ----------
drop function if exists public.archive_listings(text, int);
create or replace function public.archive_listings(p_course text default null, p_limit int default 30)
returns table(id uuid, title text, course_label text, activity bigint)
language sql security definer set search_path = public as $$
  select d.id, d.title, d.course_label,
    (coalesce((select count(*) from study_sessions s where s.deck_id = d.id), 0)
     + coalesce((select count(*) from quiz_responses q where q.deck_id = d.id), 0)) as activity
  from decks d
  where d.is_archived = true
    and (p_course is null or d.course_label ilike '%' || p_course || '%')
  order by activity desc, d.created_at desc
  limit p_limit;
$$;
grant execute on function public.archive_listings(text, int) to anon, authenticated;

drop function if exists public.archive_preview(uuid);
create or replace function public.archive_preview(p_deck_id uuid)
returns table(title text, course_label text, sample_question text, sample_answer text)
language sql security definer set search_path = public as $$
  select d.title, d.course_label, f.question, f.answer
  from decks d
  left join flashcards f on f.deck_id = d.id
  where d.id = p_deck_id and d.is_archived = true
  order by f.position nulls last, f.created_at
  limit 3;
$$;
grant execute on function public.archive_preview(uuid) to anon, authenticated;
