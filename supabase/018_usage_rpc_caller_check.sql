-- The three per-user usage RPCs (try_increment_generation_usage from 011/014,
-- try_increment_syllabus_usage and try_reserve_free_card_budget from 017) are
-- SECURITY DEFINER and granted to authenticated, but trusted whatever
-- p_user_id they were handed. Any logged-in user could call them directly via
-- PostgREST (/rest/v1/rpc/...) with someone else's user id and burn through
-- that user's daily/monthly generation, syllabus, or free-card quota.
--
-- Fix: each function now refuses to act on any user but the caller
-- (p_user_id must equal auth.uid(); `is distinct from` also rejects a null
-- auth.uid(), i.e. anon/service-role calls — nothing calls these that way).
-- Signatures are unchanged, so app/api/generate and app/api/parse-syllabus,
-- which already pass user.id from the user-scoped client, keep working.
--
-- The limit arguments (p_daily_limit, p_monthly_limit, p_requested) stay
-- caller-supplied. With the caller check in place that's harmless: a direct
-- call can only add to the caller's own counters, and the routes always
-- make their own call with the server-side limits, which is what actually
-- gates the expensive work. Huge limits just waste the caller's own quota;
-- a negative p_requested reserves nothing (v_grant <= 0 returns 0).
--
-- Bodies below are otherwise identical to 014 / 017.

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
  if p_user_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

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

create or replace function public.try_increment_syllabus_usage(
  p_user_id uuid, p_today date, p_month_start date, p_monthly_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_count int;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(syllabus_count), 0) into v_month_count
    from usage_limits where user_id = p_user_id and usage_date >= p_month_start;

  if v_month_count >= p_monthly_limit then
    return false;
  end if;

  insert into usage_limits (user_id, usage_date, syllabus_count)
  values (p_user_id, p_today, 1)
  on conflict (user_id, usage_date)
  do update set syllabus_count = usage_limits.syllabus_count + 1;

  return true;
end;
$$;

create or replace function public.try_reserve_free_card_budget(
  p_user_id uuid, p_today date, p_month_start date, p_monthly_limit int, p_requested int
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
  if p_user_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(free_cards_count), 0) into v_month_count
    from usage_limits where user_id = p_user_id and usage_date >= p_month_start;

  v_remaining := greatest(p_monthly_limit - v_month_count, 0);
  v_grant := least(p_requested, v_remaining);

  if v_grant <= 0 then
    return 0;
  end if;

  insert into usage_limits (user_id, usage_date, free_cards_count)
  values (p_user_id, p_today, v_grant)
  on conflict (user_id, usage_date)
  do update set free_cards_count = usage_limits.free_cards_count + v_grant;

  return v_grant;
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default (and Supabase
-- also grants anon), so the explicit "to authenticated" grants in 011/017
-- were never the only way in. Limit these to authenticated callers only.
revoke execute on function public.try_increment_generation_usage(uuid, date, date, int, int) from public, anon;
revoke execute on function public.try_increment_syllabus_usage(uuid, date, date, int) from public, anon;
revoke execute on function public.try_reserve_free_card_budget(uuid, date, date, int, int) from public, anon;
grant execute on function public.try_increment_generation_usage(uuid, date, date, int, int) to authenticated;
grant execute on function public.try_increment_syllabus_usage(uuid, date, date, int) to authenticated;
grant execute on function public.try_reserve_free_card_budget(uuid, date, date, int, int) to authenticated;
