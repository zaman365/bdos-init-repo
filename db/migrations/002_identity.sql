-- BDOS · 002 identity
-- Phone-first auth: Bangladesh runs on mobile numbers, not email addresses.

CREATE TYPE identity.account_state AS ENUM ('pending','active','restricted','suspended','deleted');
CREATE TYPE identity.seller_state  AS ENUM ('draft','pending_review','active','suspended','delisted');
CREATE TYPE identity.kyc_state     AS ENUM ('none','submitted','verified','rejected');

CREATE TABLE identity.user_account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  msisdn        bd_msisdn UNIQUE NOT NULL,
  handle        text UNIQUE NOT NULL CHECK (handle ~ '^[a-z0-9._]{3,24}$'),
  display_name  text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 40),
  -- Date of birth drives age gating: feed 13+, LIVE/gifting/selling 18+.
  date_of_birth date NOT NULL,
  locale        text NOT NULL DEFAULT 'bn' CHECK (locale IN ('bn','en')),
  state         identity.account_state NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER t_touch BEFORE UPDATE ON identity.user_account
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Age is derived, never stored as a number that goes stale.
CREATE OR REPLACE FUNCTION identity.age_years(dob date) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT extract(year FROM age(current_date, dob))::int
$$;

CREATE OR REPLACE FUNCTION identity.may_go_live(u identity.user_account) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT u.state = 'active' AND identity.age_years(u.date_of_birth) >= 18
$$;

CREATE TABLE identity.creator_profile (
  user_id        uuid PRIMARY KEY REFERENCES identity.user_account(id) ON DELETE CASCADE,
  bio            text CHECK (length(bio) <= 200),
  district       text,
  -- Traffic pool tier: the cold-start audition contract (docs/03 §4).
  pool_tier      smallint NOT NULL DEFAULT 1 CHECK (pool_tier BETWEEN 1 AND 5),
  rewards_opted  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity.seller (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES identity.user_account(id),
  legal_name    text NOT NULL,
  trade_name    text NOT NULL,
  -- Digital Business Identification, required by the 2021 digital commerce rules.
  dbid          text UNIQUE,
  bin           text,  -- VAT registration
  tin           text,
  state         identity.seller_state NOT NULL DEFAULT 'draft',
  -- Bharosha: the public trust score. Derived nightly, cached here.
  bharosha      numeric(4,1) NOT NULL DEFAULT 0 CHECK (bharosha BETWEEN 0 AND 100),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON identity.seller (state);
CREATE TRIGGER t_touch BEFORE UPDATE ON identity.seller
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- KYC payloads live in a separate in-country vault (docs/05 §4). This table
-- holds only a reference and the verdict, so the main DB carries no ID images.
CREATE TABLE identity.kyc_record (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES identity.user_account(id),
  seller_id   uuid REFERENCES identity.seller(id),
  vault_ref   text NOT NULL,
  state       identity.kyc_state NOT NULL DEFAULT 'submitted',
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decided_has_timestamp
    CHECK ((state IN ('verified','rejected')) = (decided_at IS NOT NULL))
);

-- Payout destinations. bKash/Nagad are the only channels creators trust.
CREATE TYPE identity.payout_channel AS ENUM ('bkash','nagad','rocket','upay','beftn');

CREATE TABLE identity.payout_method (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE CASCADE,
  channel     identity.payout_channel NOT NULL,
  account_ref text NOT NULL,
  verified_at timestamptz,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel, account_ref)
);
CREATE UNIQUE INDEX one_default_payout_per_user
  ON identity.payout_method (user_id) WHERE is_default;
