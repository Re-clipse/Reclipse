-- Apply after schema.sql and migrations 002 through 005.
-- Deploy with the matching API changes during a maintenance window.
begin;

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  operation text not null check (operation in ('generation', 'image', 'syllabus')),
  attempts integer not null check (attempts >= 0),
  primary key (user_id, usage_date, operation)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from public, anon, authenticated;
grant select on public.ai_usage to authenticated;
grant select, insert, update on public.ai_usage to service_role;
drop policy if exists "Read own AI usage" on public.ai_usage;
create policy "Read own AI usage" on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);

-- Retain existing generation usage, including today's allowance, on upgrade.
insert into public.ai_usage(user_id, usage_date, operation, attempts)
select user_id, usage_date, 'generation', greatest(generations_count, 0)
from public.usage_limits
on conflict (user_id, usage_date, operation) do update
  set attempts = greatest(public.ai_usage.attempts, excluded.attempts);
drop policy if exists "Users manage their own usage row" on public.usage_limits;
revoke all on public.usage_limits from public, anon, authenticated;
grant select on public.usage_limits to authenticated;
drop policy if exists "Read own legacy usage" on public.usage_limits;
create policy "Read own legacy usage" on public.usage_limits for select to authenticated
  using ((select auth.uid()) = user_id);

-- Only the trusted server supplies the user ID and configured limit.
-- A single conditional upsert serializes contenders for the same budget row.
-- No locks are held while the external AI request is running.
create or replace function public.reserve_ai_usage(p_user_id uuid, p_operation text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare reserved integer;
begin
  if p_user_id is null or p_operation is null
    or p_operation not in ('generation', 'image', 'syllabus')
    or p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'Invalid usage reservation' using errcode = '22023';
  end if;
  insert into public.ai_usage(user_id, usage_date, operation, attempts)
  values (p_user_id, (now() at time zone 'UTC')::date, p_operation, 1)
  on conflict (user_id, usage_date, operation) do update
    set attempts = public.ai_usage.attempts + 1
    where public.ai_usage.attempts < p_limit
  returning attempts into reserved;
  return reserved is not null;
end;
$$;
revoke all on function public.reserve_ai_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, integer) to service_role;

alter table public.decks add column if not exists save_request_id uuid;
create unique index if not exists decks_save_request_idx on public.decks(user_id, save_request_id);

-- Runs with the student's permissions: all existing RLS still applies.
-- Postgres rolls back the entire function if any insert or validation fails.
create or replace function public.save_study_set(
  p_request_id uuid, p_title text, p_source_text text, p_course_id uuid, p_material jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved_id uuid;
  item jsonb;
  option_value jsonb;
begin
  if owner_id is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if p_request_id is null or p_title is null or length(btrim(p_title)) not between 1 and 200
    or p_source_text is null or length(p_source_text) > 24000
    or jsonb_typeof(p_material) is distinct from 'object'
    or jsonb_typeof(p_material->'summary') is distinct from 'string'
    or length(p_material->>'summary') > 2000
    or jsonb_typeof(p_material->'flashcards') is distinct from 'array'
    or jsonb_typeof(p_material->'quiz') is distinct from 'array' then
    raise exception 'Invalid study set' using errcode = '22023';
  end if;
  if jsonb_array_length(p_material->'flashcards') not between 1 and 14
    or jsonb_array_length(p_material->'quiz') > 8 then
    raise exception 'Invalid study set size' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_material->'flashcards') loop
    if jsonb_typeof(item->'question') is distinct from 'string'
      or length(btrim(item->>'question')) not between 1 and 2000
      or jsonb_typeof(item->'answer') is distinct from 'string'
      or length(btrim(item->>'answer')) not between 1 and 4000
      or coalesce(item->>'type', '') not in ('basic', 'cloze') then
      raise exception 'Invalid flashcard' using errcode = '22023';
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_material->'quiz') loop
    if jsonb_typeof(item->'question') is distinct from 'string'
      or length(btrim(item->>'question')) not between 1 and 2000
      or jsonb_typeof(item->'options') is distinct from 'array'
      or jsonb_typeof(item->'correctIndex') is distinct from 'number'
      or coalesce(item->>'correctIndex', '') !~ '^[0-3]$'
      or jsonb_typeof(item->'explanation') is distinct from 'string'
      or length(item->>'explanation') > 2000 then
      raise exception 'Invalid quiz question' using errcode = '22023';
    end if;
    if jsonb_array_length(item->'options') <> 4 then
      raise exception 'Four quiz options required' using errcode = '22023';
    end if;
    for option_value in select value from jsonb_array_elements(item->'options') loop
      if jsonb_typeof(option_value) is distinct from 'string'
        or length(btrim(option_value #>> '{}')) not between 1 and 1000 then
        raise exception 'Invalid quiz option' using errcode = '22023';
      end if;
    end loop;
  end loop;

  -- A successful retry returns the original deck, never a second copy.
  select id into saved_id from public.decks
    where user_id = owner_id and save_request_id = p_request_id;
  if saved_id is not null then return saved_id; end if;
  if p_course_id is not null and not exists (
    select 1 from public.courses where id = p_course_id and user_id = owner_id
  ) then
    raise exception 'Course unavailable' using errcode = '42501';
  end if;
  insert into public.decks(user_id, title, source_text, summary, course_id, save_request_id)
  values (owner_id, btrim(p_title), p_source_text, p_material->>'summary', p_course_id, p_request_id)
  on conflict (user_id, save_request_id) do nothing returning id into saved_id;
  if saved_id is null then
    select id into saved_id from public.decks
      where user_id = owner_id and save_request_id = p_request_id;
    if saved_id is null then raise exception 'Save could not complete'; end if;
    return saved_id;
  end if;
  insert into public.flashcards(deck_id, question, answer, card_type, position)
  select saved_id, value->>'question', value->>'answer', value->>'type', ordinality - 1
    from jsonb_array_elements(p_material->'flashcards') with ordinality;
  insert into public.quiz_questions(deck_id, question, options, correct_index, explanation)
  select saved_id, value->>'question', value->'options', (value->>'correctIndex')::integer, value->>'explanation'
    from jsonb_array_elements(p_material->'quiz');
  return saved_id;
end;
$$;
revoke all on function public.save_study_set(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.save_study_set(uuid, text, text, uuid, jsonb) to authenticated;
commit;
