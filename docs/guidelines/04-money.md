# Money and sandbox policy

Store integer paisa; 100 paisa = ৳1. Validate safe integer inputs. Basis-point multiplication
uses BigInt intermediates. Journals are balanced and append-only; corrections reverse
entries. Commands use a user-scoped idempotency key with payload matching. Lock inventory,
orders, campaign budgets and payout balances inside database transactions.

The inherited 5% VAT on commission and 10% creator withholding are **illustrative sandbox
policy**, not verified Bangladesh tax advice. Category rates are the seeded category table.
Affiliate rates must not exceed the marketplace commission. Gifts publish the 60/40 split.
Commission clears after seven days; returns before then reverse the accrual. Seller funds
remain unavailable for withdrawal while their order return window is open.

Production requires approved tax configuration, licensed payment/escrow providers,
reconciliation against external settlement statements, verified KYC and operational review.
The MVP only reconciles its internal journals; a zero trial balance is not proof of bank cash.
