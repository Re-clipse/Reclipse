-- Migration 009 — profiles.referred_by had no ON DELETE behavior (NO ACTION,
-- the Postgres default), which meant deleting a user who had referred
-- someone else would fail outright with a foreign key violation the moment
-- account deletion (auth.admin.deleteUser) tried to cascade through the
-- schema. The referral was already claimed/rewarded at signup time
-- (referral_reward_log is the permanent record of that) — once the referrer
-- deletes their account, there's nothing left to point at, so null it out
-- instead of blocking the delete.

alter table profiles drop constraint if exists profiles_referred_by_fkey;
alter table profiles add constraint profiles_referred_by_fkey
  foreign key (referred_by) references auth.users(id) on delete set null;
