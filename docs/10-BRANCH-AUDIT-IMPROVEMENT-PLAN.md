# Branch audit and MVP improvement plan

Baseline: `556175b`, `codex/ecosystem-mvp`, 9 September 2026.
Goal: a dependable web MVP of the creator → viewer → seller → affiliate → creator
loop, with each advertised module operable and money transitions verifiable.

## Audit coverage

Reviewed the original ecosystem/architecture/operating documents, all application
services and routes, screen workflows, SQL migrations, money/ledger/ranking
packages, media processing, maintenance, tests, build/CI/container configuration,
and the existing marketing/waitlist/blueprint code. Earlier audits describe older
snapshots and are not current pass/fail reports.

The branch already has a coherent modular monolith, real persistence, balanced
financial entries, scoped transaction locks, protected sessions and meaningful
financial/concurrency tests. Its 95 passing tests did not exercise the following
failure paths. These are implementation gaps, not requests to replace the stack.

## Ordered implementation plan

| ID | Priority | Finding and consequence | Improvement / acceptance |
|---|---|---|---|
| A1 | High | JSON requests are fully buffered before the size check. OTP cooldown is checked separately from its update, allowing concurrent requests to overwrite codes. Browser retries generate fresh command keys. | Bound bytes while reading; atomic OTP issuance; preserve/reuse the same key after an uncertain response. Test oversized streams, concurrent OTP issuance and a lost command response. |
| A2 | High | Removing an inactive cart item requires that product to be active. Additional variants can only be created. Stock edits have no stale-write check and can overwrite inventory reserved by checkout. | Allow removal regardless of listing/flag state; edit each variant; version inventory/catalog updates and reject stale forms. Test pause/remove, variant ownership and checkout/edit races. |
| A3 | High | Every data response contains an arbitrary user directory. Media visibility does not check the author's active state. DMs and LIVE reads have inconsistent participant-state checks. | Limit contact pickers to existing relationships; enforce active-account visibility and search privacy; reject inactive recipients/hosts. Test unrelated accounts, blocks, search hiding and suspended-author media. |
| A4 | High | Images are accepted from a short signature alone, retain metadata and have no decoded-pixel limit. | Decode/re-encode images with a bounded pixel count, remove metadata, limit media processing protocols, and return useful failures. Test corrupt headers and a valid image round-trip as well as real video transcoding. |
| A5 | Medium | Navigation resets on reload; sharing opens a caption search rather than a stable post. The feed permanently hides posts beyond the newest 60; comments are unbounded. | URL-based navigation/back-forward, stable post links, cursor-based older-story pages and bounded comments. Test reload/back, exact shared post, and reachability beyond the first page. |
| A6 | High | Repeated reports create multiple cases; the newest 100 cases can hide unresolved critical work. Brand briefs can select several applicants. KYC submission/history permits contradictory active reviews. | Group pending reports, deduplicate a reporter, show evidence and critical overdue work first; enforce one selected creator and latest identity verdict. Test concurrent reports/selection and obsolete KYC approvals. |
| A7 | Medium | The legacy DB test/reset commands use fixed database names and destructive defaults. Operational guidelines incorrectly describe resolved gaps as open. | Require explicit reset intent, use a unique test DB with cleanup, improve maintenance observability/retention, and synchronize guidelines/manual/verification instructions. Run database invariants, typecheck, all regression suites and build. |

Implement A1–A7 in this order where dependencies allow. Each row is a delivery
commitment for this pass; record the final evidence below before committing.
Keep financial receipts and journals intact. Use a new forward migration; do not
rewrite migration checksums already deployed by the baseline.

## Production launch dependencies

The web MVP still needs contracted payment/courier integrations and credentials,
external settlement reconciliation, production hosting/backups, TURN for internet
LIVE, specialist review of tax/age/privacy requirements, licensed music/ASR and
native clients where the roadmap calls for them. Real provider settlement and
human operational capacity cannot be proven by local sandbox tests. These are
launch gates; this plan does not claim they are implemented or silently simulate
them outside sandbox mode. No merge to main or production deployment is requested.

## Verification and implementation record

All seven implementation rows are complete.

- **A1:** byte-bounded Node JSON requests; a single conditional OTP upsert;
  client retry receipts scoped to user/payload, with one automatic retry and
  duplicate in-flight suppression. Raw command data is not persisted in browser
  receipt storage. A browser test discards the first committed publish response
  and proves that retry returns one story.
- **A2:** paused/disabled cart removal, an edit action for every SKU, and
  database-incremented catalog/inventory versions. Checkout changes the version;
  a stale form is rejected and cannot restore sold stock.
- **A3:** relationship-based contact lists, search hiding, active-author media
  and LIVE checks, inactive-recipient DM rejection and fresh command permissions.
- **A4:** direct Sharp dependency, validated image decode, 24-megapixel input cap,
  metadata stripping, bounded 1920px WebP output and restricted FFmpeg protocols.
- **A5:** validated cursor pages with timestamp/UUID ties, stable story URLs,
  reload/back-forward navigation and at most 30 comments per story response.
- **A6:** reports linked to an open case and unique per reporter/case, evidence
  visible to operations, critical overdue cases ordered first, independent queue
  totals, one selected creator per brief and latest-verdict identity checks.
- **A7:** forward migration `012_branch_improvements.sql`; explicit reset flag;
  unique disposable invariant-test databases; maintenance counts and audit events;
  financial/legacy receipt preservation; updated CI, guidelines and manual v1.1.

### Reproduced baseline failures

An isolated `git archive` of `556175b` failed the new assertions for unrelated
contact exposure, removal of a paused cart item, and duplicate safety reports.
The OTP race was separately reproduced by adding a 100ms test-only INSERT delay:
both concurrent baseline requests succeeded. The conditional upsert passes the
same overlap test. The baseline copy never changed the working branch or its data.

### Final local checks

| Check | Result |
|---|---|
| Money, ledger and ranking unit tests | 71 passed |
| Client retry and request-stream tests | 4 passed |
| Fresh PostgreSQL integration tests | 30 passed |
| PostgreSQL invariant script | 17 passed |
| Chromium desktop/mobile tests | 10 passed |
| TypeScript and production build | Passed |
| Formatting and Git whitespace checks | Passed |
| Forward upgrade on local sandbox | Applied successfully |
| Maintenance on local sandbox | Zero ledger drift; deletion counts reported |

The integration suite verifies the added image codec, stale inventory conflicts,
variant ownership, paused-cart removal, suspended-account privacy, search hiding,
70-story pagination without overlap, bounded comments, critical queue visibility
behind 110 closed cases, concurrent brief selection, obsolete KYC rejection,
financial-receipt retention and refusal to reset existing data by default.

### Remaining scope and rollout

Apply `npm run db:migrate` before starting the updated app. Do not edit previously
applied migrations or mix old code with the new stock forms. Existing media is
not retroactively re-encoded; new image uploads use the stricter pipeline.
Historical reports/brief selections are preserved; new actions enforce the new
rules. Browser verification used synthetic accounts and simulated providers.

This pass improves the web MVP, not the multi-year production launch gates above.
The catalog/workspace caps and client-reported engagement still need scale and
abuse work; paging alone is not proof of the 500-impression audition at scale.
The existing Pages marketing code was reviewed and preserved; its waitlist still
needs deployment-level abuse controls. Docker Compose was not executable on this
host because its plugin is absent, and no container run or production deployment
is claimed. External bank/courier reconciliation remains unavailable.
