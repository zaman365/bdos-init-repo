#!/usr/bin/env bash
# BDOS database invariant tests.
#
# Negative tests each run in their OWN psql process, because the balance
# trigger is DEFERRABLE INITIALLY DEFERRED — it fires at COMMIT, which cannot
# be driven from inside a plpgsql EXCEPTION block.
#
#   ./db/test.sh
set -uo pipefail
DB=bdos_test
HERE="$(cd "$(dirname "$0")" && pwd)"
pass=0; fail=0

"$HERE/apply.sh" "$DB" >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/fixtures.sql" >/dev/null

# expect_reject <name> <error fragment> <<< sql
expect_reject() {
  local name="$1" want="$2" sql; sql=$(cat)
  local out; out=$(psql -v ON_ERROR_STOP=1 -d "$DB" -c "$sql" 2>&1)
  if [ $? -eq 0 ]; then
    printf '  FAIL  %s — statement was ACCEPTED\n' "$name"; fail=$((fail+1)); return
  fi
  if grep -qF "$want" <<<"$out"; then
    printf '  PASS  %s\n' "$name"; pass=$((pass+1))
  else
    printf '  FAIL  %s — wrong error:\n%s\n' "$name" "$out"; fail=$((fail+1))
  fi
}

expect_accept() {
  local name="$1" sql; sql=$(cat)
  local out; out=$(psql -v ON_ERROR_STOP=1 -d "$DB" -c "$sql" 2>&1)
  if [ $? -eq 0 ]; then printf '  PASS  %s\n' "$name"; pass=$((pass+1))
  else printf '  FAIL  %s — rejected but should be fine:\n%s\n' "$name" "$out"; fail=$((fail+1)); fi
}

# expect_query <name> <expected single value> <<< sql
expect_query() {
  local name="$1" want="$2" sql; sql=$(cat)
  local got; got=$(psql -At -d "$DB" -c "$sql" 2>&1 | tr -d '[:space:]')
  if [ "$got" = "$want" ]; then printf '  PASS  %s (= %s)\n' "$name" "$got"; pass=$((pass+1))
  else printf '  FAIL  %s — expected %s, got %s\n' "$name" "$want" "$got"; fail=$((fail+1)); fi
}

echo "── ledger invariants ─────────────────────────────────────────"

expect_reject "I1  single-line entry rejected" "double-entry needs at least 2" <<'EOF'
BEGIN;
INSERT INTO ledger.journal_entry (id, kind, idempotency_key, description)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','manual_correction','t-one','one line');
INSERT INTO ledger.journal_line (entry_id, account_id, amount_paisa)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001',
        (SELECT id FROM ledger.account WHERE kind='cash_mfs'), 1000);
COMMIT;
EOF

expect_reject "I2  unbalanced entry rejected" "out of balance" <<'EOF'
BEGIN;
INSERT INTO ledger.journal_entry (id, kind, idempotency_key, description)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002','manual_correction','t-unbal','unbalanced');
INSERT INTO ledger.journal_line (entry_id, account_id, amount_paisa) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000002',(SELECT id FROM ledger.account WHERE kind='cash_mfs'), 1000),
  ('aaaaaaaa-0000-0000-0000-000000000002',(SELECT id FROM ledger.account WHERE kind='escrow'), -999);
COMMIT;
EOF

expect_accept "    balanced entry accepted" <<'EOF'
BEGIN;
INSERT INTO ledger.journal_entry (id, kind, idempotency_key, description)
VALUES ('aaaaaaaa-0000-0000-0000-000000000003','order_paid_into_escrow','t-ok','balanced');
INSERT INTO ledger.journal_line (entry_id, account_id, amount_paisa) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000003',(SELECT id FROM ledger.account WHERE kind='cash_mfs'), 140000),
  ('aaaaaaaa-0000-0000-0000-000000000003',(SELECT id FROM ledger.account WHERE kind='escrow'), -140000);
COMMIT;
EOF

expect_reject "I3  journal_line UPDATE blocked" "append-only" <<'EOF'
UPDATE ledger.journal_line SET amount_paisa = 1 WHERE amount_paisa = 140000;
EOF

expect_reject "I3  journal_entry DELETE blocked" "append-only" <<'EOF'
DELETE FROM ledger.journal_entry WHERE idempotency_key = 't-ok';
EOF

expect_reject "I4  duplicate idempotency key rejected" "duplicate key" <<'EOF'
INSERT INTO ledger.journal_entry (kind, idempotency_key, description)
VALUES ('order_paid_into_escrow','t-ok','replay of the same event');
EOF

expect_query "    trial balance is zero" "0" <<'EOF'
SELECT drift_paisa FROM ledger.trial_balance;
EOF

echo ""
echo "── commerce and content constraints ─────────────────────────"

expect_reject "    order totals must add up" "totals_add_up" <<'EOF'
INSERT INTO commerce.customer_order
  (buyer_id, seller_id, payment_method, goods_paisa, delivery_paisa, discount_paisa, payable_paisa, district)
VALUES ('22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444',
        'cod', 140000, 6000, 0, 999999, 'Rajshahi');
EOF

expect_reject "    prepaid cannot exceed payable" "prepaid_within_payable" <<'EOF'
INSERT INTO commerce.customer_order
  (buyer_id, seller_id, payment_method, goods_paisa, delivery_paisa, payable_paisa, prepaid_paisa, district)
VALUES ('22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444',
        'cod', 140000, 6000, 146000, 200000, 'Rajshahi');
EOF

expect_reject "    self-gifting blocked" "no_self_gifting" <<'EOF'
INSERT INTO live.session (id, host_id, state) VALUES
  ('77777777-7777-7777-7777-777777777777','11111111-1111-1111-1111-111111111111','live');
INSERT INTO live.gift_send (session_id, gift_id, sender_id, host_id, gross_paisa, creator_paisa, platform_paisa)
VALUES ('77777777-7777-7777-7777-777777777777',1,'11111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111', 1000, 600, 400);
EOF

expect_reject "    gift split must add up" "split_adds_up" <<'EOF'
INSERT INTO live.session (id, host_id, state) VALUES
  ('88888888-8888-8888-8888-888888888888','11111111-1111-1111-1111-111111111111','live');
INSERT INTO live.gift_send (session_id, gift_id, sender_id, host_id, gross_paisa, creator_paisa, platform_paisa)
VALUES ('88888888-8888-8888-8888-888888888888',1,'22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 1000, 600, 999);
EOF

expect_reject "    unlicensed sound cannot claim a licence" "licensed_needs_ref" <<'EOF'
INSERT INTO content.sound (title, duration_ms, is_licensed, licence_ref)
VALUES ('Unlicensed track', 30000, true, NULL);
EOF

expect_reject "    non-BD phone number rejected" "bd_msisdn" <<'EOF'
INSERT INTO identity.user_account (msisdn, handle, display_name, date_of_birth)
VALUES ('+14155550123','someone','Someone','1990-01-01');
EOF

expect_reject "    spark ad needs creator consent" "spark_needs_post_and_consent" <<'EOF'
INSERT INTO ads.advertiser (id, owner_id, name) VALUES
  ('aaaa0000-0000-0000-0000-00000000000a','33333333-3333-3333-3333-333333333333','Test Co');
INSERT INTO ads.campaign (id, advertiser_id, objective, pricing, daily_budget_paisa, bid_paisa)
VALUES ('bbbb0000-0000-0000-0000-00000000000b','aaaa0000-0000-0000-0000-00000000000a',
        'product_sales','cpa', 500000, 2000);
INSERT INTO ads.creative (campaign_id, is_spark, post_id, creator_consent_at)
VALUES ('bbbb0000-0000-0000-0000-00000000000b', true, NULL, NULL);
EOF

echo ""
echo "── age gating ───────────────────────────────────────────────"

expect_query "    adult (27) may go live" "t" <<'EOF'
SELECT identity.may_go_live(u) FROM identity.user_account u WHERE handle='nusrat';
EOF

expect_query "    minor (14) may NOT go live" "f" <<'EOF'
SELECT identity.may_go_live(u) FROM identity.user_account u WHERE handle='tamim';
EOF

expect_query "    minor's age computed correctly" "14" <<'EOF'
SELECT identity.age_years(date_of_birth) FROM identity.user_account WHERE handle='tamim';
EOF

echo ""
printf '── %d passed, %d failed ─────────────────────────────────────\n' "$pass" "$fail"
dropdb --if-exists "$DB" >/dev/null 2>&1
[ "$fail" -eq 0 ]
