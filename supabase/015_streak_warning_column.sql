-- Dedup guard for the streak-loss warning email in send-reminders/route.js,
-- mirroring the existing last_digest_sent_at pattern.
alter table profiles add column if not exists last_streak_warning_sent_at timestamptz;
