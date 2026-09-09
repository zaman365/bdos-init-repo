-- BDOS · 007 live and gifts
-- Coins are prepaid digital goods, NOT a transferable payment instrument.
-- Bangladesh Bank rules make that distinction load-bearing (docs/05 §4).

CREATE TYPE live.session_state AS ENUM ('scheduled','live','ended','terminated');

CREATE TABLE live.session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES identity.user_account(id),
  title       text,
  state       live.session_state NOT NULL DEFAULT 'scheduled',
  -- LIVE is 18+; enforced at start, re-checked on resume.
  started_at  timestamptz,
  ended_at    timestamptz,
  peak_viewers int NOT NULL DEFAULT 0,
  gift_paisa  paisa NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ended_after_start CHECK (ended_at IS NULL OR started_at IS NOT NULL)
);
CREATE INDEX ON live.session (host_id, started_at DESC);
CREATE INDEX ON live.session (state) WHERE state = 'live';

-- Culturally native catalogue, not a generic rose (docs/04 §5).
CREATE TABLE live.gift_catalog (
  id        smallint PRIMARY KEY,
  slug      text UNIQUE NOT NULL,
  name_en   text NOT NULL,
  name_bn   text NOT NULL,
  price_paisa paisa NOT NULL,
  -- The split is PUBLISHED. Creator keeps 60% at launch (docs/02 §S4).
  creator_share_bp int NOT NULL DEFAULT 6000 CHECK (creator_share_bp BETWEEN 0 AND 10000),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE live.gift_send (
  id          bigserial PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES live.session(id) ON DELETE CASCADE,
  gift_id     smallint NOT NULL REFERENCES live.gift_catalog(id),
  sender_id   uuid NOT NULL REFERENCES identity.user_account(id),
  host_id     uuid NOT NULL REFERENCES identity.user_account(id),
  qty         int NOT NULL DEFAULT 1 CHECK (qty > 0),
  gross_paisa paisa NOT NULL,
  creator_paisa paisa NOT NULL,
  platform_paisa paisa NOT NULL,
  entry_id    uuid REFERENCES ledger.journal_entry(id),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT split_adds_up CHECK (gross_paisa = creator_paisa + platform_paisa),
  CONSTRAINT no_self_gifting CHECK (sender_id <> host_id)
);
CREATE INDEX ON live.gift_send (session_id, sent_at);
CREATE INDEX ON live.gift_send (host_id, sent_at DESC);
