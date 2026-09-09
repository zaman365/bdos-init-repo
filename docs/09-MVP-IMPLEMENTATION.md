# MVP implementation and verification record

9 September 2026. This record follows the snapshot audit in `08-SYSTEM-AUDIT.md`;
that audit describes an earlier, partially written tree, not the delivered state.

## Delivered

- Six responsive product surfaces and supporting seller, partner, inbox, LIVE,
  profile/safety and operations screens. Locally bundled Anek Bangla/Latin fonts.
- PostgreSQL persistence, transactional migrations, idempotent seeding, role checks,
  protected media, validated request payloads and safe error responses.
- Phone OTP with HMAC hashing, single-use codes and persistent attempt/rate limits;
  HttpOnly/SameSite sessions and Secure cookies outside the explicit local sandbox.
  A configurable HTTPS SMS adapter exists; demo OTP disclosure is sandbox-only.
- Catalog variants, atomic stock reservation, grouped checkout, vouchers, escrow,
  buyer-confirmed dispatch, sandbox logistics, delivery, RTO, whole-order returns.
- Affiliate plans, samples, showcase, click attribution, visible commission holds,
  clear/clawback, verified sandbox destinations and non-double-spend withdrawals.
- Real upload validation, FFmpeg video transcoding, HTTP byte ranges, manual captions,
  trim playback, templates, drafts and consent-controlled remix lineage.
- Small-room WebRTC signalling and camera broadcast, persistent chat, culturally
  named gifts, exact published splits and journalled balances.
- Spark consent/revocation, human campaign approval, budget/credit checks, labelled
  placements, signed impression tokens and deduplicated engagement/conversions.
- Protective defaults, block/report, explicit phrase filtering, human decisions,
  bilingual reasons, one appeal, partner leads, audit logs and feature switches.

## Audit follow-up

| Earlier finding | Current disposition |
|---|---|
| H1 build/type errors | Fixed; dependencies declared and scripts implemented |
| H2 production authentication absent | HTTPS SMS adapter contract added; provider still requires configuration |
| H3 missing UI | All listed MVP surfaces have operable screens |
| H4 global mutation lock | Replaced with ordered party/entity scopes; inventory/order rows also lock transactionally |
| M1 duplicate escrow logic | Application now calls the tested `releaseEscrow` package function |
| M2 bare OTP hashes | Replaced with purpose-bound HMAC and a required production secret |
| M3 insecure production cookie | Secure outside sandbox; HTTPS origin required for mutations |
| M4 user directory | Small sandbox directory remains; production discovery/contact policy is a documented limitation |
| M5 ranking tests | Concurrent foundation work supplied contract, diversity and search tests; retained and verified |
| M6 missing scripts | Seed/integration/browser tests and maintenance commands are present |
| L1 transient retention | Maintenance prunes OTPs, sessions, rate limits and signalling; financial receipts remain retained |
| L2 capped notification outcome | Cap retained; authoritative records remain visible independently of notifications |
| L3 constant query fragments | Parameterized user values retained; static composition is not user interpolation |

The global write lock was removed only after lifecycle and concurrency tests
exercised overselling, payout double-spend and cross-account access. This does
not constitute a load/scale benchmark. GET data routes do not issue state-changing
ad-placement records; placement eligibility is signed without mutating the database.

## Verification

Final local results on 9 September 2026: **71/71 unit tests, 18/18 PostgreSQL
integration tests, 6/6 Chromium browser tests (desktop and Pixel 7), TypeScript,
format checking and the production build passed.** Manual 390px browser checks
also covered seller product creation and repeated draft saves followed by publish.
Docker Compose could not be executed on this host because the Compose plugin is
not installed; its configuration is supplied without a claimed container run.

- Unit suite: integer-paisa splits, rounding, allocation, balanced money lifecycle,
  refunds/clawbacks, audition slots, diversity and Banglish search.
- Integration suite: fresh unique PostgreSQL database per run; auth, permissions,
  each view, COD/digital delivery, refunds/RTO, vouchers/attribution, inventory
  races, sample flow, gifting/payout races, moderation/appeal, draft/media privacy,
  Spark consent/budget, kill switches, journal constraints and sandbox refusal.
- Media integration uses a generated one-second clip, performs a real transcode,
  tests byte ranges, and rejects spoofed image content. No personal media is used.
- Browser workflow checks cover locale switching, product-tag cart entry, checkout,
  module navigation and responsive layout. A reusable Playwright suite is included
  and wired to CI for desktop and mobile.
- `npm run verify` is the required local gate. Browser tests run separately with
  `npm run test:e2e`, after Playwright Chromium installation and sandbox seeding.

## Honest boundaries

This is an executable **web MVP with sandbox commerce providers**, not the
multi-year ecosystem’s production completion. The exact feature boundaries are
listed in `07-MVP-AUDIT.md` and the user manual. In particular: no native Android/iOS,
real-money PSP/courier adapters, licensed music/ASR/AR, warehouse operations,
learned ranking/moderation, off-site ad tracking, recurring subscriptions,
real external reconciliation, or internet-scale LIVE relay.

Docker/Compose and CI configurations are supplied. The existing marketing Pages
site and private blueprint gate are preserved; the new app needs Node hosting,
PostgreSQL and a persistent media volume. Nothing in this branch push merges to
`main` or reconfigures the live marketing deployment.
