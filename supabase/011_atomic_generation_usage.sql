-- app/api/generate/route.js previously read usage_limits, checked the caps
-- in application code, then wrote the increment as a separate step — two
-- concurrent requests (double-click, two tabs) could both read before
-- either wrote, both pass the check, and both call Anthropic, exceeding
-- the monthly cost cap the comments there explicitly rely on. This makes
-- the check-and-increment one atomic operation, serialized per user via a
-- transaction-scoped advisory lock (works even before that user's first
-- usage_limits row exists, unlike `select ... for update`).
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
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(generations_count, 0) into v_today_count
    from usage_limits where user_id = p_user_id and usage_date = p_today;
  select coalesce(sum(generations_count), 0) into v_month_count
    from usage_limits where user_id = p_user_id and usage_date >= p_month_start;

  if coalesce(v_today_count, 0) >= p_daily_limit or v_month_count >= p_monthly_limit then
    return false;
  end if;

  insert into usage_limits (user_id, usage_date, generations_count)
  values (p_user_id, p_today, 1)
  on conflict (user_id, usage_date)
  do update set generations_count = usage_limits.generations_count + 1;

  return true;
end;
$$;
grant execute on function public.try_increment_generation_usage(uuid, date, date, int, int) to authenticated;
