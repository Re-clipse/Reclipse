-- Migration 007 — Referral rewards.
--
-- When someone signs up with a friend's referral code AND becomes a paying
-- Campus Archive subscriber (not just a free account), both the referrer and
-- the referred user get a discount off their next month — a Stripe coupon
-- applied to their Stripe customer, never cash or account credit.
--
-- The reward is granted from the webhook (app/api/archive/webhook/route.js),
-- server-side, only after Stripe confirms a real payment — never from
-- anything the client claims.

alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid references auth.users(id);
alter table profiles add column if not exists referral_rewarded boolean not null default false;

-- These three columns are only ever written by server code (the referral-code
-- API route and the claim_referral()/webhook functions below, all of which run
-- with the service role or as SECURITY DEFINER). The existing "own profile"
-- policy lets a user update their own row for other fields (display_name,
-- school, ...); revoking column-level UPDATE here stops a client from setting
-- referred_by/referral_rewarded/referral_code directly through the API and
-- self-granting a reward.
revoke update (referral_code, referred_by, referral_rewarded) on profiles from authenticated;

-- ---------- Referral attribution ----------
-- Called once, right after a new account's first sign-up, with whatever
-- ?ref= code (if any) was captured before they signed up. SECURITY DEFINER
-- so it can write the otherwise-locked columns above; auth.uid() still
-- reflects the calling user, so it can only ever attribute the CALLER's own
-- referral, never anyone else's.
create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
  v_set boolean;
begin
  if p_code is null or auth.uid() is null then
    return false;
  end if;

  select user_id into v_referrer from profiles where referral_code = p_code;
  if v_referrer is null or v_referrer = auth.uid() then
    return false; -- unknown code, or someone trying to "refer" themselves
  end if;

  insert into profiles (user_id, referred_by)
  values (auth.uid(), v_referrer)
  on conflict (user_id) do update
    set referred_by = v_referrer
    where profiles.referred_by is null;

  select (referred_by = v_referrer) into v_set from profiles where user_id = auth.uid();
  return coalesce(v_set, false);
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;

-- ---------- Reward bookkeeping ----------
-- One row per referred user, inserted exactly once (primary key), the moment
-- the reward is granted. This is the real guard against double-granting on a
-- replayed Stripe webhook — profiles.referral_rewarded mirrors it for the
-- client-facing UI but this table is the source of truth.
create table if not exists referral_reward_log (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_id uuid references auth.users(id) on delete cascade not null,
  coupon_id text,
  created_at timestamptz default now()
);

alter table referral_reward_log enable row level security;

drop policy if exists "see referrals you made" on referral_reward_log;
create policy "see referrals you made" on referral_reward_log
  for select using (referrer_id = auth.uid());
-- No client write policy: rows are inserted only by the webhook (service role).
