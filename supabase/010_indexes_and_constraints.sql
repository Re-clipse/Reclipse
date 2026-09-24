-- Missing FK-side indexes flagged by the database review: Postgres never
-- auto-indexes the referencing side of a foreign key, and these are the
-- most common filters/joins in the app (deck_id lookups, per-user lists,
-- and the activity aggregates in popular_decks()/archive_listings()).
-- Plain (non-CONCURRENTLY) is fine at this table size and keeps this a
-- single transactional migration.
create index if not exists idx_flashcards_deck_id on flashcards(deck_id);
create index if not exists idx_quiz_questions_deck_id on quiz_questions(deck_id);
create index if not exists idx_decks_user_id_created on decks(user_id, created_at desc);
create index if not exists idx_courses_user_id on courses(user_id);
create index if not exists idx_decks_course_id on decks(course_id) where course_id is not null;
create index if not exists idx_course_events_user_id on course_events(user_id, event_date);
create index if not exists idx_study_sessions_deck_id on study_sessions(deck_id);
create index if not exists idx_quiz_responses_deck_id on quiz_responses(deck_id);

-- Enum-like text columns had no CHECK constraint, so a bad write (a typo in
-- a future migration, a hand-run script) could silently fall through the
-- app's TYPE_LABEL/status-equality logic. Verified against live data first:
-- only flashcards.card_type currently has rows (basic/cloze, both valid);
-- the other three tables are currently empty.
alter table course_events add constraint course_events_event_type_check
  check (event_type in ('exam', 'quiz', 'lab', 'assignment', 'other'));
alter table study_plan_sessions add constraint study_plan_sessions_status_check
  check (status in ('pending', 'done', 'skipped'));
alter table flashcards add constraint flashcards_card_type_check
  check (card_type in ('basic', 'cloze'));
alter table quiz_questions add constraint quiz_questions_correct_index_check
  check (correct_index >= 0 and correct_index < jsonb_array_length(options));
