# 01 — Engineering guidelines

## Choosing where a rule lives

A rule that matters gets enforced in **two** places: the database and the
application. This is not redundancy for its own sake — an invariant that lives
in only one layer is an invariant that gets bypassed by the next code path.

The ledger is the worked example. `db/migrations/005_ledger.sql` enforces
balance, minimum line count, append-only history and idempotency with triggers
and constraints. `packages/ledger` enforces the same four in TypeScript. Either
layer alone would be a liability.

## Types

- Money is `Paisa` — an integer. Never `number` meaning "taka", never a float,
  never a `NUMERIC` column read through a float parser.
- Values crossing a trust boundary get a **runtime** guard, not a cast. A
  database row is not TypeScript-checked: use `toAccountKind()`, not `as`.
- `any` and `as` in the money path are review-blocking. The typecheck failure
  in `lib/commerce.ts` (audit H1) existed precisely because journal lines were
  built from bare strings.

## APIs

- Reads are `GET`, mutations are `POST`. No exceptions — `SameSite=Lax` cookies
  make a state-changing `GET` a CSRF hole.
- Every mutation carries a client-supplied idempotency key, and replaying a key
  with a different payload is a `409`, not a silent overwrite.
- Errors say what went wrong and what to do next, in the user's language. No
  apologies, no stack traces, no "something went wrong".
- Never interpolate into SQL. `lib/read.ts` currently builds three queries by
  concatenation; they are not injectable today, but the pattern is banned in
  new code.

## Concurrency

- A global lock is not a concurrency strategy. `lib/locks.ts` resolves affected
  parties and entities and acquires advisory locks in lexical order. Preserve
  that order across all command and maintenance paths.
- Stock and catalog forms carry database versions. A stale update fails with
  409 and asks the seller to refresh; it must never restore inventory reserved
  by a concurrent checkout.
- Anything that touches two parties' money happens in one transaction, or it
  happens with a compensating entry. There is no third option.

## Testing

- Money and ranking rules need tests that assert the **promise**, not the
  implementation. "The audition is honoured" survives a rewrite; "the boost is
  1.5" does not.
- Prefer a property test where an invariant is universal. `splitBp` is checked
  across ~24,000 amount/rate combinations because "the parts sum to the whole"
  must hold for all of them, not for three examples.
- Test the failure paths. Refunds, clawbacks and RTO are where money goes
  wrong, and they are the paths nobody exercises by hand.
- A test that passes against code you did not read is not evidence. See
  [08](08-operations.md) on shared working trees.

## Review

Blocking: untyped money paths, a new global lock, SQL by concatenation, a
product promise implemented as a tunable weight, a rule enforced in one layer
only, a new dependency that is not in `package.json`.

Not blocking: formatting, naming preferences, dense-but-tested code.
