-- Migration 018 — Reclipse Plus, the new premium subscription, and a
-- card-budget usage model to replace the flat generation-count caps.
--
-- Premium is NOT Campus Archive. Archive (006) is shelved and untouched —
-- this is a separate table, separate access-check function, separate
-- Stripe product/checkout/webhook. Nothing here reads or writes
-- archive_subscriptions.
--
-- New usage model: free = 1 generation/day, up to 900 flashcards/month.
-- Premium = no daily limit, up to 2700 flashcards/month. Both are measured
-- in CARDS, not generation-call count, since one call can produce anywhere
-- from a handful of cards to the max — a card-based budget is what actually
-- tracks cost. The old generation-count RPCs (011, 017) are left in place,
-- unused, rather than dropped.
--
-- The launch-week free-premium trial (everyone has premium for the first
-- week, then it becomes paid) is a single global date, not per-user data —
-- handled in application code via NEXT_PUBLIC_PREMIUM_TRIAL_ENDS_AT
-- (lib/premiumTrial.js), not stored here.

-- ---------- Subscriptions ----------
create table if not exists premium_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null,                 -- Stripe status: active, trialing, past_due, canceled, ...
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

alter table premium_subscriptions enable row level security;

drop policy if exists "users see their own premium subscription" on premium_subscriptions;
create policy "users see their own premium subscription" on premium_subscriptions
  for select using (user_id = auth.uid());
-- No client write policies on purpose, same reasoning as archive_subscriptions
-- (006): rows are written only by the Stripe webhook (service role) after
-- Stripe's signature verifies the event.

create or replace function public.has_premium_access()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from premium_subscriptions
    where user_id = auth.uid()
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;
grant execute on function public.has_premium_access() to authenticated;

-- ---------- Usage: card-budget model ----------
alter table usage_limits add column if not exists cards_count int not null default 0;

-- Daily throttle only. Free tier only — premium has no daily limit and
-- simply never calls this. Separate from the monthly card budget below,
-- which is what actually bounds cost.
create or replace function public.try_increment_daily_generation(
  p_user_id uuid, p_today date, p_daily_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(generations_count, 0) into v_today_count
    from usage_limits where user_id = p_user_id and usage_date = p_today;

  if coalesce(v_today_count, 0) >= p_daily_limit then
    return false;
  end if;

  insert into usage_limits (user_id, usage_date, generations_count)
  values (p_user_id, p_today, 1)
  on conflict (user_id, usage_date)
  do update set generations_count = usage_limits.generations_count + 1;

  return true;
end;
$$;
grant execute on function public.try_increment_daily_generation(uuid, date, int) to authenticated;

-- Monthly card budget, shared by both tiers (caller passes the tier's own
-- limit). Reserves min(requested, remaining) BEFORE the AI call and does
-- NOT refund it if the generation attempt fails to parse — a wasted attempt
-- still costs real Anthropic tokens, so it still costs the user's budget,
-- by design (same reservation-not-refunded pattern as 017's now-superseded
-- try_reserve_free_card_budget).
create or replace function public.try_reserve_card_budget(
  p_user_id uuid, p_today date, p_month_start date, p_monthly_card_limit int, p_requested int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_count int;
  v_remaining int;
  v_grant int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(cards_count), 0) into v_month_count
    from usage_limits where user_id = p_user_id and usage_date >= p_month_start;

  v_remaining := greatest(p_monthly_card_limit - v_month_count, 0);
  v_grant := least(p_requested, v_remaining);

  if v_grant <= 0 then
    return 0;
  end if;

  insert into usage_limits (user_id, usage_date, cards_count)
  values (p_user_id, p_today, v_grant)
  on conflict (user_id, usage_date)
  do update set cards_count = usage_limits.cards_count + v_grant;

  return v_grant;
end;
$$;
grant execute on function public.try_reserve_card_budget(uuid, date, date, int, int) to authenticated;
