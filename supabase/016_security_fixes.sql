-- Security fixes from a broad AppSec/Cloud-Security audit round:
--
-- 1. Migration 014 added profiles.bonus_generations (a column that directly
--    raises a user's effective AI-generation cap) but never revoked client
--    UPDATE on it, unlike referral_code/referred_by/referral_rewarded in 007
--    — any authenticated user could PATCH their own row via PostgREST and
--    self-grant unlimited generations. claim_referral() is SECURITY DEFINER
--    and doesn't need client UPDATE access to write it.
revoke update (bonus_generations) on profiles from authenticated;

-- 2. usage_limits had a "for all" policy granting the client raw
--    insert/update/delete on their own rows — but every write is supposed to
--    go through try_increment_generation_usage() (SECURITY DEFINER, atomic
--    per-user lock). A client could bypass the daily/monthly generation cap
--    entirely by deleting or updating their own usage_limits rows directly.
--    Nothing in the app ever writes here directly (confirmed: zero
--    references outside that RPC), so select-only is a safe restriction.
drop policy if exists "Users manage their own usage row" on usage_limits;
create policy "Users can view their own usage row" on usage_limits
  for select using (auth.uid() = user_id);

-- 3. Soft-deleting a deck (013) never taught any of the "someone else can
--    read this deck" policies/functions about deleted_at — a deck that was
--    public, shared with a collaborator, purchased, or archive-subscribed-to
--    stayed fully readable by those other users for up to 30 days (until
--    purge-trash hard-deletes it), even though the owner believed it was
--    gone the moment they trashed it.
create or replace function public.is_deck_collaborator(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from deck_collaborators c join decks d on d.id = c.deck_id
    where c.deck_id = p_deck and c.user_id = auth.uid() and d.deleted_at is null
  );
$$;

create or replace function public.can_edit_deck_cards(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from decks d
    where d.id = p_deck and d.deleted_at is null
      and (
        d.user_id = auth.uid()
        or (d.collab_enabled = true
            and exists (select 1 from deck_collaborators c
                        where c.deck_id = d.id and c.user_id = auth.uid()))
      )
  );
$$;

create or replace function public.has_purchased_deck(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from deck_purchases p join decks d on d.id = p.deck_id
    where p.deck_id = p_deck and p.buyer_user_id = auth.uid() and d.deleted_at is null
  );
$$;

create or replace function public.is_archived_deck(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from decks where id = p_deck and is_archived = true and deleted_at is null);
$$;

drop policy if exists "public decks are readable" on decks;
create policy "public decks are readable" on decks for select
  using (is_public = true and deleted_at is null);

drop policy if exists "public deck cards are readable" on flashcards;
create policy "public deck cards are readable" on flashcards for select
  using (deck_id in (select id from decks where is_public = true and deleted_at is null));

drop policy if exists "public deck quiz is readable" on quiz_questions;
create policy "public deck quiz is readable" on quiz_questions for select
  using (deck_id in (select id from decks where is_public = true and deleted_at is null));

-- Same gap in the two anonymous listing/preview RPCs (popular_decks backs
-- Discover, archive_listings/archive_preview back Campus Archive).
create or replace function public.popular_decks(p_course text default null, p_limit int default 20)
returns table(id uuid, title text, course_label text, share_id text, activity bigint)
language sql security definer set search_path = public as $$
  select d.id, d.title, d.course_label, d.share_id,
    (coalesce((select count(*) from study_sessions s where s.deck_id = d.id), 0)
     + coalesce((select count(*) from quiz_responses q where q.deck_id = d.id), 0)) as activity
  from decks d
  where d.is_public = true and d.deleted_at is null
    and (p_course is null or d.course_label ilike '%' || p_course || '%')
  order by activity desc, d.created_at desc
  limit p_limit;
$$;

create or replace function public.archive_listings(p_course text default null, p_limit int default 30)
returns table(id uuid, title text, course_label text, activity bigint)
language sql security definer set search_path = public as $$
  select d.id, d.title, d.course_label,
    (coalesce((select count(*) from study_sessions s where s.deck_id = d.id), 0)
     + coalesce((select count(*) from quiz_responses q where q.deck_id = d.id), 0)) as activity
  from decks d
  where d.is_archived = true and d.deleted_at is null
    and (p_course is null or d.course_label ilike '%' || p_course || '%')
  order by activity desc, d.created_at desc
  limit p_limit;
$$;

create or replace function public.archive_preview(p_deck_id uuid)
returns table(title text, course_label text, sample_question text, sample_answer text)
language sql security definer set search_path = public as $$
  select d.title, d.course_label, f.question, f.answer
  from decks d
  left join flashcards f on f.deck_id = d.id
  where d.id = p_deck_id and d.is_archived = true and d.deleted_at is null
  order by f.position nulls last, f.created_at
  limit 3;
$$;
