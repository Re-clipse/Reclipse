-- Second-column-of-composite-key / non-first-key-column indexes flagged by
-- the database review as fine today but worth adding before they aren't.
create index if not exists idx_deck_collaborators_user_id on deck_collaborators(user_id);
create index if not exists idx_deck_purchases_buyer_user_id on deck_purchases(buyer_user_id);
create index if not exists idx_referral_reward_log_referrer_id on referral_reward_log(referrer_id);
