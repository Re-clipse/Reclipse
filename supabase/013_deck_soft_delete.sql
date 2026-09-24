-- Soft-delete for decks: "Delete" now sets deleted_at instead of removing
-- the row outright, so it can be undone. Rows past the 30-day retention
-- window are hard-deleted by the daily /api/purge-trash cron (same
-- CASCADE behavior applies whenever that final delete happens).
alter table decks add column if not exists deleted_at timestamptz;
create index if not exists idx_decks_deleted_at on decks(deleted_at) where deleted_at is not null;
