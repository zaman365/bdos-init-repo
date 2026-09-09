-- BDOS · 006 affiliate
-- Affiliate commission is customer-acquisition cost priced on success.

CREATE TYPE affiliate.plan_kind AS ENUM ('open','targeted','shop');
CREATE TYPE affiliate.sample_state AS ENUM ('requested','approved','rejected','shipped','received','content_posted','expired');

CREATE TABLE affiliate.plan (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid NOT NULL REFERENCES identity.seller(id) ON DELETE CASCADE,
  kind       affiliate.plan_kind NOT NULL,
  rate_bp    int NOT NULL CHECK (rate_bp BETWEEN 0 AND 2000),
  -- Targeted plans name their creators; open plans are for anyone.
  is_active  boolean NOT NULL DEFAULT true,
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sane_window CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX ON affiliate.plan (seller_id) WHERE is_active;

CREATE TABLE affiliate.plan_product (
  plan_id    uuid NOT NULL REFERENCES affiliate.plan(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES commerce.product(id) ON DELETE CASCADE,
  rate_bp    int CHECK (rate_bp BETWEEN 0 AND 2000),
  PRIMARY KEY (plan_id, product_id)
);

CREATE TABLE affiliate.plan_creator (
  plan_id    uuid NOT NULL REFERENCES affiliate.plan(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, creator_id)
);

-- The single highest-leverage mechanic in the system (docs/01 §4.4).
CREATE TABLE affiliate.sample_request (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES identity.user_account(id),
  product_id uuid NOT NULL REFERENCES commerce.product(id),
  state      affiliate.sample_state NOT NULL DEFAULT 'requested',
  pitch      text CHECK (length(pitch) <= 500),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, product_id)
);
CREATE INDEX ON affiliate.sample_request (product_id, state);

-- Attribution. A click is recorded, then matched to an order inside the window.
CREATE TABLE affiliate.click (
  id          bigserial PRIMARY KEY,
  creator_id  uuid NOT NULL REFERENCES identity.user_account(id),
  product_id  uuid NOT NULL REFERENCES commerce.product(id),
  post_id     uuid REFERENCES content.post(id),
  viewer_id   uuid REFERENCES identity.user_account(id),
  -- Fraud signals: device and address clustering catch self-purchase rings.
  device_hash text,
  ip_hash     text,
  clicked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON affiliate.click (viewer_id, product_id, clicked_at DESC);
CREATE INDEX ON affiliate.click (creator_id, clicked_at DESC);
CREATE INDEX ON affiliate.click (device_hash, clicked_at DESC);

CREATE TABLE affiliate.attribution (
  order_item_id uuid PRIMARY KEY REFERENCES commerce.order_item(id) ON DELETE CASCADE,
  creator_id    uuid NOT NULL REFERENCES identity.user_account(id),
  plan_id       uuid NOT NULL REFERENCES affiliate.plan(id),
  click_id      bigint REFERENCES affiliate.click(id),
  rate_bp       int NOT NULL CHECK (rate_bp BETWEEN 0 AND 2000),
  -- Set when fraud review rejects the attribution; blocks commission clearing.
  rejected_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON affiliate.attribution (creator_id);
