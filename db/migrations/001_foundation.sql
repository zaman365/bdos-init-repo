-- BDOS · 001 foundation
-- Money is ALWAYS integer paisa (1 BDT = 100 paisa). Never float, never numeric.
-- Rationale: docs/guidelines/04-money.md — float money bugs are unrecoverable
-- once they reach a creator's payout statement.

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS ledger;
CREATE SCHEMA IF NOT EXISTS affiliate;
CREATE SCHEMA IF NOT EXISTS live;
CREATE SCHEMA IF NOT EXISTS ads;
CREATE SCHEMA IF NOT EXISTS trust;

-- Non-negative amounts (prices, fees). The ledger uses raw bigint because
-- journal lines are signed.
CREATE DOMAIN paisa AS bigint CHECK (VALUE >= 0);

-- Bangladesh mobile numbers, normalised to E.164 (+8801XXXXXXXXX).
CREATE DOMAIN bd_msisdn AS text CHECK (VALUE ~ '^\+8801[3-9][0-9]{8}$');

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Append-only guard for the ledger. Money history is never rewritten;
-- corrections are reversing entries.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted (post a reversing entry instead)',
    TG_TABLE_NAME, TG_OP;
END $$;
