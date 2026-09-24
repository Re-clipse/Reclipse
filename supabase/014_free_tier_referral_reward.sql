-- The existing referral reward (a Stripe discount) only fires once a
-- referred friend PAYS for Campus Archive — worthless to the majority of
-- students who'd never subscribe, even though claim_referral() already
-- attributes every signup regardless of payment. This adds a second,
-- free-tier-reachable reward: bonus monthly AI generations for every
-- genuine referred signup, independent of any payment.
alter table profiles add column if not exists bonus_generations int not null default 0;

create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
  v_newly_set boolean;
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

  -- ROW_COUNT from the statement above: 1 only if this call is what just set
  -- the attribution (new row, or the WHERE let the update through) — 0 on any
  -- redundant re-call, so the bonus below can never be double-granted.
  get diagnostics v_newly_set = row_count;

  if v_newly_set then
    update profiles set bonus_generations = coalesce(bonus_generations, 0) + 5 where user_id = v_referrer;
  end if;

  select (referred_by = v_referrer) into v_set from profiles where user_id = auth.uid();
  return coalesce(v_set, false);
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;

-- profiles has an "own row only" RLS select policy, so a user can't just
-- query how many other profiles have referred_by = their own id. This
-- surfaces that count (plus their current bonus) without widening RLS.
create or replace function public.referral_stats()
returns table(referred_count int, bonus_generations int)
language sql security definer set search_path = public as $$
  select
    (select count(*)::int from profiles where referred_by = auth.uid()),
    (select coalesce(bonus_generations, 0) from profiles where user_id = auth.uid());
$$;
grant execute on function public.referral_stats() to authenticated;

-- The generation-cap function (migration 011) needs to add each user's
-- bonus_generations on top of the plain monthly limit. Same signature,
-- replaced body only.
create or replace function public.try_increment_generation_usage(
  p_user_id uuid, p_today date, p_month_start date, p_daily_limit int, p_monthly_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_count int;
  v_month_count int;
  v_bonus int;
  v_effective_monthly_limit int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(bonus_generations, 0) into v_bonus from profiles where user_id = p_user_id;
  v_effective_monthly_limit := p_monthly_limit + coalesce(v_bonus, 0);

  select coalesce(generations_count, 0) into v_today_count
    from usage_limits where user_id = p_user_id and usage_date = p_today;
  select coalesce(sum(generations_count), 0) into v_month_count
    from usage_limits where user_id = p_user_id and usage_date >= p_month_start;

  if coalesce(v_today_count, 0) >= p_daily_limit or v_month_count >= v_effective_monthly_limit then
    return false;
  end if;

  insert into usage_limits (user_id, usage_date, generations_count)
  values (p_user_id, p_today, 1)
  on conflict (user_id, usage_date)
  do update set generations_count = usage_limits.generations_count + 1;

  return true;
end;
$$;
