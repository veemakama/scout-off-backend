-- Migration 002: trial_offers table
-- Records trial offers submitted on-chain by scouts.
-- A trial offer advances the target player to Elite Tier (Level 3).

CREATE TABLE IF NOT EXISTS trial_offers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scout       TEXT    NOT NULL,
  player_id   TEXT    NOT NULL,
  details_uri TEXT    NOT NULL,              -- IPFS CID pointing to offer details
  ledger      INTEGER NOT NULL,
  tx_hash     TEXT    NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Fast lookups by scout and by player
CREATE INDEX IF NOT EXISTS idx_trial_offers_scout     ON trial_offers (scout);
CREATE INDEX IF NOT EXISTS idx_trial_offers_player_id ON trial_offers (player_id);
