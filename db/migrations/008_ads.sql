-- BDOS · 008 ads
-- Ads never merge into organic scoring: separate auction, capped density,
-- always labelled (docs/03 §4).

CREATE TYPE ads.objective AS ENUM ('reach','traffic','engagement','conversion','product_sales');
CREATE TYPE ads.campaign_state AS ENUM ('draft','pending_review','active','paused','exhausted','ended');
CREATE TYPE ads.pricing AS ENUM ('cpm','cpc','cpa');

CREATE TABLE ads.advertiser (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES identity.user_account(id),
  seller_id  uuid REFERENCES identity.seller(id),
  name       text NOT NULL,
  balance_paisa paisa NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ads.campaign (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES ads.advertiser(id) ON DELETE CASCADE,
  objective     ads.objective NOT NULL,
  pricing       ads.pricing NOT NULL,
  state         ads.campaign_state NOT NULL DEFAULT 'draft',
  daily_budget_paisa paisa NOT NULL CHECK (daily_budget_paisa > 0),
  bid_paisa     paisa NOT NULL CHECK (bid_paisa > 0),
  spent_paisa   paisa NOT NULL DEFAULT 0,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ads.campaign (state) WHERE state = 'active';

-- Spark-style: promote an organic creator post, with permission and rev-share.
CREATE TABLE ads.creative (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ads.campaign(id) ON DELETE CASCADE,
  post_id     uuid REFERENCES content.post(id),
  is_spark    boolean NOT NULL DEFAULT false,
  -- A spark creative REQUIRES the creator's recorded consent.
  creator_consent_at timestamptz,
  revshare_bp int NOT NULL DEFAULT 0 CHECK (revshare_bp BETWEEN 0 AND 10000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spark_needs_post_and_consent
    CHECK (NOT is_spark OR (post_id IS NOT NULL AND creator_consent_at IS NOT NULL))
);
