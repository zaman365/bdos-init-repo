-- BDOS · 004 commerce
-- Cash on delivery is first-class, not a fallback (docs/05 §2).

CREATE TYPE commerce.order_state AS ENUM (
  'created','awaiting_payment','paid_in_escrow','confirmed','shipped',
  'delivered','completed','cancelled','returned','refunded'
);
CREATE TYPE commerce.payment_method AS ENUM ('cod','bkash','nagad','rocket','upay','card');
CREATE TYPE commerce.shipment_state AS ENUM (
  'pending','picked_up','in_transit','out_for_delivery','delivered','failed','returned_to_origin'
);

CREATE TABLE commerce.category (
  id            smallint PRIMARY KEY,
  slug          text UNIQUE NOT NULL,
  name_en       text NOT NULL,
  name_bn       text NOT NULL,
  -- Commission is per category: beauty high, electronics low (docs/06 §3).
  commission_bp int NOT NULL CHECK (commission_bp BETWEEN 0 AND 2000)
);

CREATE TABLE commerce.product (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES identity.seller(id),
  category_id smallint NOT NULL REFERENCES commerce.category(id),
  title_bn    text NOT NULL,
  title_en    text,
  description text,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON commerce.product (seller_id) WHERE is_active;
CREATE INDEX ON commerce.product (category_id) WHERE is_active;
CREATE TRIGGER t_touch BEFORE UPDATE ON commerce.product
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE commerce.sku (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES commerce.product(id) ON DELETE CASCADE,
  code         text NOT NULL,
  variant_label text,
  price_paisa  paisa NOT NULL,
  stock        int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (product_id, code)
);

-- Products tagged inside a post: SKUs are rankable objects in the same feed.
CREATE TABLE commerce.post_product (
  post_id    uuid NOT NULL REFERENCES content.post(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES commerce.product(id) ON DELETE CASCADE,
  -- The creator who tagged it, for affiliate attribution.
  tagged_by  uuid NOT NULL REFERENCES identity.user_account(id),
  PRIMARY KEY (post_id, product_id)
);

CREATE TABLE commerce.courier (
  id       smallint PRIMARY KEY,
  slug     text UNIQUE NOT NULL,
  name     text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- Per-route scoring: partners get reassigned when their district success drops.
CREATE TABLE commerce.courier_route_score (
  courier_id  smallint NOT NULL REFERENCES commerce.courier(id),
  district    text NOT NULL,
  delivered   int NOT NULL DEFAULT 0,
  failed      int NOT NULL DEFAULT 0,
  rto         int NOT NULL DEFAULT 0,
  avg_hours   numeric(6,2),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (courier_id, district)
);

CREATE TABLE commerce.customer_order (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          uuid NOT NULL REFERENCES identity.user_account(id),
  seller_id         uuid NOT NULL REFERENCES identity.seller(id),
  state             commerce.order_state NOT NULL DEFAULT 'created',
  payment_method    commerce.payment_method NOT NULL,
  -- Totals in paisa. goods + delivery - discount = payable.
  goods_paisa       paisa NOT NULL,
  delivery_paisa    paisa NOT NULL DEFAULT 0,
  discount_paisa    paisa NOT NULL DEFAULT 0,
  payable_paisa     paisa NOT NULL,
  -- COD first orders take the delivery fee up front (docs/05 §2).
  prepaid_paisa     paisa NOT NULL DEFAULT 0,
  district          text NOT NULL,
  -- Escrow release is gated on delivery confirmation, by law.
  escrow_released_at timestamptz,
  return_window_ends timestamptz,
  placed_at         timestamptz NOT NULL DEFAULT now(),
  delivered_at      timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT totals_add_up
    CHECK (payable_paisa = goods_paisa + delivery_paisa - discount_paisa),
  CONSTRAINT prepaid_within_payable CHECK (prepaid_paisa <= payable_paisa),
  CONSTRAINT delivered_has_timestamp
    CHECK ((state IN ('delivered','completed')) <= (delivered_at IS NOT NULL))
);
CREATE INDEX ON commerce.customer_order (buyer_id, placed_at DESC);
CREATE INDEX ON commerce.customer_order (seller_id, placed_at DESC);
CREATE INDEX ON commerce.customer_order (state);
CREATE TRIGGER t_touch BEFORE UPDATE ON commerce.customer_order
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE commerce.order_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES commerce.customer_order(id) ON DELETE CASCADE,
  sku_id        uuid NOT NULL REFERENCES commerce.sku(id),
  qty           int NOT NULL CHECK (qty > 0),
  unit_paisa    paisa NOT NULL,
  line_paisa    paisa NOT NULL,
  -- Which post drove this line, if any. The affiliate attribution anchor.
  source_post_id uuid REFERENCES content.post(id),
  CONSTRAINT line_math CHECK (line_paisa = unit_paisa * qty)
);
CREATE INDEX ON commerce.order_item (order_id);

CREATE TABLE commerce.shipment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES commerce.customer_order(id) ON DELETE CASCADE,
  courier_id  smallint NOT NULL REFERENCES commerce.courier(id),
  tracking    text,
  state       commerce.shipment_state NOT NULL DEFAULT 'pending',
  -- OTP confirmed before dispatch: an RTO countermeasure.
  otp_confirmed_at timestamptz,
  dispatched_at timestamptz,
  settled_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON commerce.shipment (order_id);
CREATE INDEX ON commerce.shipment (state);
