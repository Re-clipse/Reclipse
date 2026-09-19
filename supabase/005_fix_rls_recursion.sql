-- Migration 005 — fix infinite recursion in RLS policies.
--
-- Bug introduced in 003: the `decks` collaborator policy queried
-- `deck_collaborators`, whose own policy queried `decks` — Postgres detected
-- the cycle and errored ("infinite recursion detected in policy for relation
-- decks") on any query that made it evaluate both. 004 made it reachable via
-- deck_purchases.
--
-- Fix: move each cross-table membership check into a SECURITY DEFINER function.
-- Those run with the definer's rights, so they do NOT re-trigger RLS on the
-- table they read, which breaks the cycle. Each one is deliberately narrow:
-- it takes a deck id, returns a boolean about the *current* user, and leaks
-- nothing else.

create or replace function public.is_deck_owner(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from decks where id = p_deck and user_id = auth.uid());
$$;

create or replace function public.is_deck_collaborator(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from deck_collaborators where deck_id = p_deck and user_id = auth.uid());
$$;

-- Collaborators may edit cards only while collaboration is actually switched on.
create or replace function public.can_edit_deck_cards(p_deck uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from decks d
    where d.id = p_deck
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
  select exists (select 1 from deck_purchases
                 where deck_id = p_deck and buyer_user_id = auth.uid());
$$;

grant execute on function public.is_deck_owner(uuid)        to authenticated;
grant execute on function public.is_deck_collaborator(uuid) to authenticated;
grant execute on function public.can_edit_deck_cards(uuid)  to authenticated;
grant execute on function public.has_purchased_deck(uuid)   to authenticated;

-- ---- Rewrite every policy that previously crossed tables inline ----

drop policy if exists "see own collaboration or your deck's collaborators" on deck_collaborators;
create policy "see own collaboration or your deck's collaborators" on deck_collaborators
  for select using (user_id = auth.uid() or public.is_deck_owner(deck_id));

drop policy if exists "owner removes collaborators" on deck_collaborators;
create policy "owner removes collaborators" on deck_collaborators
  for delete using (public.is_deck_owner(deck_id));

drop policy if exists "collaborators can view their decks" on decks;
create policy "collaborators can view their decks" on decks
  for select using (public.is_deck_collaborator(id));

drop policy if exists "collaborators manage flashcards" on flashcards;
create policy "collaborators manage flashcards" on flashcards
  for all using (public.can_edit_deck_cards(deck_id))
  with check (public.can_edit_deck_cards(deck_id));

drop policy if exists "purchasers view archived flashcards" on flashcards;
create policy "purchasers view archived flashcards" on flashcards
  for select using (public.has_purchased_deck(deck_id));

drop policy if exists "buyer or seller can view purchase" on deck_purchases;
create policy "buyer or seller can view purchase" on deck_purchases
  for select using (buyer_user_id = auth.uid() or public.is_deck_owner(deck_id));

-- Buyers also need to read the deck row itself (title etc.) once purchased.
drop policy if exists "purchasers can view the deck" on decks;
create policy "purchasers can view the deck" on decks
  for select using (public.has_purchased_deck(id));
