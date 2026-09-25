-- Two new atomic rate limits, modeled on 011_atomic_generation_usage.sql's
-- check-and-increment-under-advisory-lock pattern:
--   1. Syllabus uploads: a flat monthly count, same shape as generations_count.
--   2. Free-tier flashcard budget: instead of a plain counter, this reserves
--      however many of the requested cards still fit under the monthly cap
--      and returns that number, so the caller can ask the model for exactly
--      that many instead of generating extra and throwing them away.

alter table public.usage_limits
  add column if not exists syllabus_count int not null default 0,
  add column if not exists free_cards_count int not null default 0;

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
grant execute on function public.try_increment_syllabus_usage(uuid, date, date, int) to authenticated;

-- Reserves min(p_requested, whatever remains of p_monthly_limit) and returns
-- that count. Returns 0 (not an error) once the monthly budget is exhausted,
-- so the caller can turn that into a clear "upgrade for more" response.
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
grant execute on function public.try_reserve_free_card_budget(uuid, date, date, int, int) to authenticated;
