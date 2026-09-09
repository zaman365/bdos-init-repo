# 08 — System audit

Audited 9 September 2026 on branch `codex/ecosystem-mvp` at commit `f14423a`.
Scope: the whole repository — 10 migrations plus `011_mvp.sql`, `packages/`
(money, ledger, ranking), `lib/` (12 modules, 674 lines), `app/` (100 lines),
the public `site/`, and the two prior audit/planning documents.

Method: every finding below was reproduced by running something — `tsc`, the
test suites, `psql` against a real database, or a targeted script. Findings I
could not reproduce are recorded as such, including one inherited from
`docs/07-MVP-AUDIT.md`.

Total first-party code: **3,043 lines**.

---

## Verdict

| Area | State | Note |
|---|---|---|
| Database schema | **Solid** | 8 schemas, integer-paisa money, 17 invariants proven against real PostgreSQL |
| Money package | **Solid** | Exactness invariant verified across ~24,000 combinations |
| Ledger package | **Solid** | 32 tests; all business events balance; property test over 1,000 lifecycles |
| Application modules (`lib/`) | **Works, unverified** | No unit or integration tests cover any of the 674 lines |
| Ranking | **Stub** | 9 lines of heuristic, zero tests |
| User interface | **Stub** | 100 lines total; `page.tsx` is 2 lines. No surface has a real UI |
| Build gate | **Broken** | `npm run typecheck` fails; three npm scripts point at missing files |
| Production readiness | **No** | No real auth path, no SMS, no PSP, no courier, no media pipeline |

The data and money foundations are genuinely sound. Everything above them is
either a thin sandbox or absent.

---

## Findings

Severity is about this project's own goals, not abstract risk.

### H1 · The build gate is broken — `npm run typecheck` fails
`lib/commerce.ts:84` constructs ledger lines from bare string literals, so
`AccountKind` is never enforced at the one place it matters most — the money
path. A typo like `platform_revenu` would compile and post a journal to a
non-existent account.
`lib/media.ts:29` imports `ffmpeg-static`, which is not in `package.json`.
Consequence: `npm run verify` cannot pass, so nothing enforces the other rules.
**Fix:** type the line builders and either declare the dependency or drop it.

### H2 · No production authentication path
`lib/auth.ts` gates `auth/request` behind `requireSandbox()` and returns the
OTP in the HTTP response (`sandboxCode`). Correctly fenced for local work, but
it means **no real person can sign up**: there is no SMS provider, so the
platform cannot onboard a single user outside a sandbox.
**Fix:** an SMS provider interface with a sandbox implementation behind it, so
the production path exists and is merely unconfigured.

### H3 · No user interface for any of the six surfaces
`app/` is 100 lines: a layout, a 2-line page, a 39-line shell, 21 lines of
primitives. The six surfaces in `docs/02` — feed, Cut, Shop, Studio, Affiliate,
Ads — have API handlers but nothing a person can operate.
**Fix:** this is the largest remaining body of work. Feed and Shop first.

### H4 · Every mutation serialises behind one global lock
`lib/commands.ts:14` takes `pg_advisory_xact_lock(802005)` for *all* writes, so
the platform processes one mutation at a time globally. The code comments say
so, which is honest, but it is a hard ceiling of roughly one write transaction
at a time — unusable beyond a demo.
**Fix:** ordered per-entity locks (order, then seller, then creator) so
unrelated writes proceed in parallel while cross-account money stays ordered.

### M1 · Escrow release is implemented twice
`lib/commerce.ts` hand-builds the escrow-release journal instead of calling
`releaseEscrow()` from `packages/ledger`. Both versions balance today — I
verified the hand-built one sums to zero including the discount case — but two
implementations of the same money rule will diverge, and only one of them has
tests.
**Fix:** `lib/commerce.ts` must call the package. The package is the rule.

### M2 · OTP codes are hashed with bare SHA-256
`lib/db.ts:hash()` is unsalted SHA-256, used for both session tokens and OTP
codes. For a 32-byte random session token that is fine. For a **six-digit** OTP
the keyspace is 10⁶, so anyone who reads `app.otp` recovers every live code by
brute force in milliseconds.
**Fix:** HMAC the OTP with a server-side secret, or use a slow KDF.

### M3 · Session cookie may ship without `Secure`
`lib/auth.ts` appends `Secure` only when `APP_ORIGIN` starts with `https:`. If
that variable is unset or misconfigured in production, session cookies travel
in clear text.
**Fix:** default to `Secure` and require an explicit opt-out for local HTTP.

### M4 · `sessionInfo()` returns a directory of up to 100 users
Any authenticated caller receives `id`, `handle` and `display_name` for up to
100 other accounts. It is a demo convenience for the people-picker, but it is
also a user-enumeration endpoint.
**Fix:** restrict to accounts the caller already has a relationship with.

### M5 · `packages/ranking` has no tests
Nine lines carrying the cold-start audition boost, the report penalty and the
author-diversity pass — all rules `docs/03` calls contracts — with nothing
asserting them. The audition guarantee in particular is stated as a promise to
creators.
**Fix:** tests for the audition guarantee, the diversity cap, and determinism.

### M6 · Three npm scripts point at files that do not exist
`db:seed` → `scripts/seed.ts` (absent) · `test:integration` →
`tests/integration.test.ts` (absent; the directory is `e2e/`) · `test:e2e` →
`e2e/` is empty. Scripts that fail on invocation train people to ignore them.

### L1 · Unbounded operational tables
`app.rate_limit`, `app.otp` and `app.command` accumulate rows with no reaper.
`app.command` in particular stores a JSON response per idempotency key forever.
**Fix:** a scheduled cleanup, and a retention note in the runbook.

### L2 · `notify()` silently discards past ten per day
`lib/db.ts:notify()` inserts only while the user has fewer than ten
notifications today. The daily cap matches `docs/02`, but the caller cannot
tell a drop from a delivery.
**Fix:** return the outcome so callers can decide.

### L3 · SQL assembled by string concatenation in `lib/read.ts`
Three queries interpolate fragments (lines 11, 37, 40). I checked each: the
interpolated values are a module constant and a two-branch ternary over
literals, so **none is injectable today**. Flagged only because the pattern
invites a future mistake in the highest-value queries in the system.

---

## Corrections to `docs/07-MVP-AUDIT.md`

That document is largely accurate, and two of its findings were real gaps in my
original schema that `011_mvp.sql` correctly closed:

- A `journal_entry` with **zero** lines never fired the line-level balance
  trigger, so an empty journal could be created. Its `check_header()` trigger
  fixes this.
- A **balanced pair** of lines could be appended to an already-posted entry in
  a later transaction, mutating history while still summing to zero. Its
  `lock_posted_entry()` trigger fixes this.

One finding I initially recorded as "not reproducible" — **that was my error**:

> "Money multiplication could lose precision near the safe-integer limit."

I tested `splitBp` at magnitudes up to 9×10¹⁵ paisa with fifteen-significant-digit
values and awkward rates, measured zero drift, and concluded the concern was
structural rather than real. That conclusion was wrong for a simple reason: by
the time I ran those tests, `packages/money` had already been rewritten to
multiply in **BigInt** —

```ts
const share = Number((BigInt(total) * BigInt(bp)) / 10_000n);
```

so I was measuring the fixed implementation, not the one the finding described.
The original code was `Math.floor((total * bp) / 10_000)`, which does lose
low-order bits once `total × bp` passes 2⁵³.

**The finding was valid and the BigInt rewrite is the correct fix** — better
than the range guard I had drafted, because it is exact at every magnitude
instead of refusing large ones. `packages/money/test` now pins this with cases
that all exceed 2⁵³ after multiplication, including `MAX_SAFE_INTEGER` at
10,000bp.

Lesson recorded for the runbook: on a tree more than one agent is editing,
re-read the source at the moment of testing. A green test against code that
changed under you proves nothing about the code you meant to test.

Also noted from that document, and correct:

Also noted from that document, and correct: `docs/06`'s staffing table sums to
**134**, not the "~110" its prose claims, and the category seed rates span
2.5–9% against a stated 3–8%. Both are inconsistencies in my earlier planning
docs and are fixed in this pass.

---

## What "complete" requires

Ordered by what unblocks the most downstream work.

| # | Work | Why it comes here |
|---|---|---|
| 1 | Fix the build gate (H1), wire scripts (M6) | Nothing else is verifiable until `verify` passes |
| 2 | Single escrow implementation (M1), ranking tests (M5) | Money and the audition promise must have one tested definition |
| 2a | **Agent coordination** — see "Concurrency hazard" below | Two agents on one working tree will overwrite each other |
| 3 | Security pass: OTP hashing, cookie flags, directory scope (M2–M4) | Cheap, and each is a real exposure |
| 4 | Per-entity locking (H4) | Removes the global write ceiling |
| 5 | Provider interfaces: SMS, PSP, courier, media (H2) | Lets the production path exist while unconfigured |
| 6 | Integration tests over `lib/` | 674 lines of money-touching code with no coverage |
| 7 | The six surfaces as real UI (H3) | The largest remaining effort |
| 8 | Video pipeline, Bangla moderation, learned ranking | The roadmap work in `docs/03`; months, not days |

Items 1–6 are the difference between "a demo that runs" and "a system that can
be trusted". Item 7 is the difference between that and a product. Item 8 is
`docs/06` phases P1–P5 and is not a gap so much as the plan.


---

## Concurrency hazard (found during this audit)

Two agents were editing this working tree at the same time: this session and a
ChatGPT Codex session (`codex sandbox`, PIDs 36406/36407). Evidence:

- `app/components/shop.tsx` and `content.tsx` appeared while the audit was running.
- `app/components/Shell.tsx` was left mid-edit and did not parse (`TS1005`),
  which suppressed every semantic error in the project and made `tsc` output
  misleading.
- `packages/money/src/index.ts` was rewritten under me between writing a fix
  and testing it, which is how the precision correction above went wrong.
- `git add -A` in commit `f14423a` swept up Codex's in-progress files, so a
  non-parsing `Shell.tsx` is committed history.

Consequences to avoid repeating:

1. **Never `git add -A` on a shared tree.** Stage explicit paths.
2. **A parse error anywhere blinds `tsc` everywhere.** Check that the tree
   parses before trusting a clean typecheck.
3. **Partition ownership by directory** — one agent in `app/`, another in
   `packages/` and `db/` — or give each its own git worktree.

Until that is settled, findings H1 (build gate) and H3 (no UI) cannot be
reliably fixed from this session: both live in files the other agent is
actively rewriting.
