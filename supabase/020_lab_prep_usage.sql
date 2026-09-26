-- Migration 020 — usage tracking for the premium-only Lab Prep AI chat
-- (Ticket 2 / Phase 3). Lab Prep is not Campus Archive and not the
-- flashcard card-budget — it gates on has_premium_access() (018) and
-- reuses that same table + atomic-reservation pattern, but with boolean
-- grant semantics instead of a partial integer grant: a chat turn is
-- indivisible, unlike a batch of flashcards.

alter table usage_limits add column if not exists lab_prep_turns_count int not null default 0;

-- Same advisory-lock pattern as try_increment_daily_generation (018), just
-- scoped to a rolling month instead of a single day — Lab Prep is
-- premium-only and has no separate daily throttle, only this monthly cap.
create or replace function public.try_reserve_lab_prep_turn(
  p_user_id uuid, p_today date, p_month_start date, p_monthly_turn_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(lab_prep_turns_count), 0) into v_month_count
    from usage_limits where user_id = p_user_id and usage_date >= p_month_start;

  if v_month_count >= p_monthly_turn_limit then
    return false;
  end if;

  insert into usage_limits (user_id, usage_date, lab_prep_turns_count)
  values (p_user_id, p_today, 1)
  on conflict (user_id, usage_date)
  do update set lab_prep_turns_count = usage_limits.lab_prep_turns_count + 1;

  return true;
end;
$$;
grant execute on function public.try_reserve_lab_prep_turn(uuid, date, date, int) to authenticated;
