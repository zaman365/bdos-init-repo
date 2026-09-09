-- BDOS · 005 ledger
--
-- Double-entry, append-only. Sign convention: a journal line is POSITIVE for a
-- debit and NEGATIVE for a credit, and every entry must sum to exactly zero.
-- Nothing rewrites history; a mistake is corrected with a reversing entry.
--
-- Invariants enforced in the database, not in application code:
--   I1  every entry has >= 2 lines
--   I2  every entry sums to 0
--   I3  entries and lines can never be updated or deleted
--   I4  an idempotency key posts at most one entry
-- See docs/guidelines/04-money.md.

CREATE TYPE ledger.account_kind AS ENUM (
  'cash_mfs',          -- asset:     money actually sitting in an MFS/bank account
  'cod_receivable',    -- asset:     cash a courier has collected but not settled
  'escrow',            -- liability: buyer money held pending delivery (by law)
  'seller_payable',    -- liability: owed to a seller
  'creator_payable',   -- liability: cleared commission owed to a creator
  'commission_held',   -- liability: commission accrued but inside the return window
  'gift_liability',    -- liability: creator share of gifts not yet cleared
  'coin_liability',    -- liability: unspent prepaid coins
  'tax_withheld',      -- liability: source tax withheld, owed to NBR
  'courier_payable',   -- liability: delivery charges owed to a courier
  'platform_revenue',  -- revenue:   our take
  'refund_expense',    -- expense:   refunds we absorb
  'rto_expense'        -- expense:   return-to-origin courier cost we absorb
);

CREATE TYPE ledger.owner_kind AS ENUM ('platform','user','seller','courier');

-- Which side increases this kind of account.
CREATE OR REPLACE FUNCTION ledger.normal_side(k ledger.account_kind) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN k IN ('cash_mfs','cod_receivable','refund_expense','rto_expense') THEN 'debit'
    ELSE 'credit'
  END
$$;

CREATE TABLE ledger.account (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       ledger.account_kind NOT NULL,
  owner_kind ledger.owner_kind NOT NULL,
  owner_id   uuid,
  currency   char(3) NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_accounts_have_no_owner
    CHECK ((owner_kind = 'platform') = (owner_id IS NULL))
);
-- One account per (kind, owner). Two partial uniques because NULL owner_id
-- would otherwise never collide.
CREATE UNIQUE INDEX account_party_uniq ON ledger.account (kind, owner_kind, owner_id)
  WHERE owner_id IS NOT NULL;
CREATE UNIQUE INDEX account_platform_uniq ON ledger.account (kind)
  WHERE owner_id IS NULL;

CREATE TYPE ledger.entry_kind AS ENUM (
  'order_paid_into_escrow','cod_collected','escrow_released_to_seller',
  'commission_accrued','commission_cleared','commission_clawed_back',
  'refund_issued','rto_cost_absorbed',
  'coins_purchased','gift_sent','gift_cleared',
  'payout_executed','tax_remitted','manual_correction'
);

CREATE TABLE ledger.journal_entry (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            ledger.entry_kind NOT NULL,
  -- I4: replaying the same business event can never double-post.
  idempotency_key text UNIQUE NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  description     text NOT NULL,
  -- Reversals point at what they reverse, so corrections are auditable.
  reverses_id     uuid REFERENCES ledger.journal_entry(id),
  order_id        uuid REFERENCES commerce.customer_order(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ledger.journal_entry (order_id);
CREATE INDEX ON ledger.journal_entry (kind, occurred_at DESC);

CREATE TABLE ledger.journal_line (
  id         bigserial PRIMARY KEY,
  entry_id   uuid NOT NULL REFERENCES ledger.journal_entry(id),
  account_id uuid NOT NULL REFERENCES ledger.account(id),
  -- Signed: + debit, - credit. Zero-value lines are meaningless.
  amount_paisa bigint NOT NULL CHECK (amount_paisa <> 0),
  memo       text
);
CREATE INDEX ON ledger.journal_line (entry_id);
CREATE INDEX ON ledger.journal_line (account_id);

-- I1 + I2, checked once per transaction rather than per row.
CREATE OR REPLACE FUNCTION ledger.assert_entry_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_entry uuid := NEW.entry_id;
  v_sum   bigint;
  v_lines int;
BEGIN
  SELECT coalesce(sum(amount_paisa), 0), count(*)
    INTO v_sum, v_lines
    FROM ledger.journal_line WHERE entry_id = v_entry;

  IF v_lines < 2 THEN
    RAISE EXCEPTION 'entry % has % line(s); double-entry needs at least 2', v_entry, v_lines
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_sum <> 0 THEN
    RAISE EXCEPTION 'entry % is out of balance by % paisa', v_entry, v_sum
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER journal_line_balanced
  AFTER INSERT ON ledger.journal_line
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger.assert_entry_balanced();

-- I3: append-only.
CREATE TRIGGER journal_entry_immutable
  BEFORE UPDATE OR DELETE ON ledger.journal_entry
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER journal_line_immutable
  BEFORE UPDATE OR DELETE ON ledger.journal_line
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Balances, in the account's natural direction.
CREATE VIEW ledger.account_balance AS
SELECT a.id AS account_id, a.kind, a.owner_kind, a.owner_id,
       ledger.normal_side(a.kind) AS normal_side,
       CASE WHEN ledger.normal_side(a.kind) = 'debit'
            THEN coalesce(sum(l.amount_paisa), 0)
            ELSE -coalesce(sum(l.amount_paisa), 0)
       END AS balance_paisa
FROM ledger.account a
LEFT JOIN ledger.journal_line l ON l.account_id = a.id
GROUP BY a.id, a.kind, a.owner_kind, a.owner_id;

-- The whole book must sum to zero. Anything else means a bug; this is what the
-- nightly reconciliation job asserts before it pages a human.
CREATE VIEW ledger.trial_balance AS
SELECT coalesce(sum(amount_paisa), 0) AS drift_paisa,
       count(DISTINCT entry_id) AS entries,
       count(*) AS lines
FROM ledger.journal_line;

CREATE TYPE ledger.accrual_state AS ENUM ('held','clearable','cleared','clawed_back');

CREATE TABLE ledger.commission_accrual (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL UNIQUE REFERENCES commerce.order_item(id),
  creator_id    uuid NOT NULL REFERENCES identity.user_account(id),
  seller_id     uuid NOT NULL REFERENCES identity.seller(id),
  gross_paisa   paisa NOT NULL,
  rate_bp       int NOT NULL CHECK (rate_bp BETWEEN 0 AND 2000),
  commission_paisa   paisa NOT NULL,
  withholding_paisa  paisa NOT NULL DEFAULT 0,
  net_paisa     paisa NOT NULL,
  state         ledger.accrual_state NOT NULL DEFAULT 'held',
  -- Shown plainly in the creator app. An invisible hold reads as theft.
  hold_until    timestamptz NOT NULL,
  accrued_entry_id uuid NOT NULL REFERENCES ledger.journal_entry(id),
  cleared_entry_id uuid REFERENCES ledger.journal_entry(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT net_math CHECK (net_paisa = commission_paisa - withholding_paisa)
);
CREATE INDEX ON ledger.commission_accrual (creator_id, state);
CREATE INDEX ON ledger.commission_accrual (state, hold_until);

CREATE TYPE ledger.payout_state AS ENUM ('requested','processing','paid','failed','reversed');

CREATE TABLE ledger.payout (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_id        uuid NOT NULL REFERENCES identity.user_account(id),
  payout_method_id uuid NOT NULL REFERENCES identity.payout_method(id),
  amount_paisa    paisa NOT NULL CHECK (amount_paisa > 0),
  state           ledger.payout_state NOT NULL DEFAULT 'requested',
  -- Payout success rate is a launch gate: >= 99.5% (docs/06 P3).
  provider_ref    text,
  failure_reason  text,
  entry_id        uuid REFERENCES ledger.journal_entry(id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  settled_at      timestamptz,
  CONSTRAINT failed_has_reason
    CHECK ((state = 'failed') = (failure_reason IS NOT NULL))
);
CREATE INDEX ON ledger.payout (payee_id, requested_at DESC);
CREATE INDEX ON ledger.payout (state);
