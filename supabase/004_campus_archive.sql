-- Migration 004 — Premium Campus Archive (paid deck unlocks).

alter table decks add column if not exists is_archived boolean not null default false;
alter table decks add column if not exists archive_price_cents int;

create table if not exists deck_purchases (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references decks(id) on delete cascade not null,
  buyer_user_id uuid references auth.users(id) on delete cascade not null,
  amount_cents int not null,
  stripe_session_id text unique,
  created_at timestamptz default now(),
  unique (deck_id, buyer_user_id)
);

alter table deck_purchases enable row level security;

-- Buyers see their own purchases; deck owners see who bought their deck (earnings visibility).
drop policy if exists "buyer or seller can view purchase" on deck_purchases;
create policy "buyer or seller can view purchase" on deck_purchases for select
  using (
    buyer_user_id = auth.uid()
    or deck_id in (select id from decks where user_id = auth.uid())
  );
-- No client insert policy on purpose: purchases are only ever written by the
-- Stripe webhook via the admin client, after Stripe itself confirms payment.
-- A client-writable "I paid" flag would be trivially fakeable.

-- Purchasers (and the owner) can read an archived deck's actual flashcards.
-- Everyone else gets only the capped preview below, never full content, even
-- if they inspect network requests directly — this is enforced at the DB row
-- level, not just hidden in the UI.
drop policy if exists "purchasers view archived flashcards" on flashcards;
create policy "purchasers view archived flashcards" on flashcards for select
  using (
    deck_id in (
      select d.id from decks d
      where d.is_archived = true
        and d.id in (select deck_id from deck_purchases where buyer_user_id = auth.uid())
    )
  );

-- Capped, safe preview for a listing page — title/price/3 sample cards only.
-- security definer on purpose: lets anyone (even logged-out) see enough to
-- decide whether to buy, without ever exposing the full deck pre-purchase.
create or replace function public.archive_preview(p_deck_id uuid)
returns table(title text, course_label text, price_cents int, sample_question text, sample_answer text)
language sql security definer set search_path = public as $$
  select d.title, d.course_label, d.archive_price_cents, f.question, f.answer
  from decks d
  left join flashcards f on f.deck_id = d.id
  where d.id = p_deck_id and d.is_archived = true
  order by f.position nulls last, f.created_at
  limit 3;
$$;
grant execute on function public.archive_preview(uuid) to anon, authenticated;

-- Listing page: every archived deck, anonymous, with a rough demand signal
-- reused from the same activity metric Campus Popular already computes.
create or replace function public.archive_listings(p_course text default null, p_limit int default 30)
returns table(id uuid, title text, course_label text, price_cents int, activity bigint)
language sql security definer set search_path = public as $$
  select d.id, d.title, d.course_label, d.archive_price_cents,
    (coalesce((select count(*) from study_sessions s where s.deck_id = d.id), 0)
     + coalesce((select count(*) from quiz_responses q where q.deck_id = d.id), 0)) as activity
  from decks d
  where d.is_archived = true and d.archive_price_cents > 0
    and (p_course is null or d.course_label ilike '%' || p_course || '%')
  order by activity desc, d.created_at desc
  limit p_limit;
$$;
grant execute on function public.archive_listings(text, int) to anon, authenticated;
