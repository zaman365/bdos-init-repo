# BDOS — বিডস

**Bangladesh On Stage.** দেখো · কিনো · কামাও — Watch · Buy · Earn.

A runnable Next.js + PostgreSQL web MVP spanning Discover, Cut, Shop, Creator
Studio, Affiliate, Ads, small-room LIVE, Seller Center, Nirapod, Partner Network,
and Operations. It includes persistent accounts and data, role checks, video
transcoding, inventory/escrow/returns, an append-only ledger, and automated tests.

**Payments, payouts, courier events and demo identity checks are explicitly
sandboxed.** Native apps, production payment integrations, scaled LIVE delivery,
trained moderation/ranking and other roadmap features are not represented as complete.

## Run

```sh
docker compose up --build
# Open http://localhost:3000
```

Or use Node 22.19+ and PostgreSQL 17+:

```sh
npm ci
cp .env.example .env.local
# Configure DATABASE_URL and APP_ORIGIN for a dedicated local database.
npm run db:migrate
npm run db:seed
npm run dev
```

The sandbox login offers Viewer, Creator, Seller, Operations and Partner accounts
and displays a one-use OTP. For full instructions and account details, read the
**[BDOS MVP User Manual](docs/BDOS-MVP-USER-MANUAL.md)**.

## Verify

```sh
npm run verify       # TypeScript, unit tests, isolated DB integration, production build
npm run test:e2e     # Desktop/mobile browser suite; requires Playwright Chromium
npm run maintenance # Clear due commissions and remove expired transient records
```

Tests require a disposable PostgreSQL database and `CREATEDB` permission.
`db:migrate` is non-destructive and checksum-checked. The legacy `db:apply` script creates a dedicated local database; resetting an
existing one requires explicit `./db/apply.sh --reset bdos_dev`.

## Repository map

| Path                    | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `app/`                  | Responsive Bangla/English application and HTTP routes            |
| `lib/`                  | Authentication, domain workflows, scoped locking, queries, media |
| `packages/`             | Money, ledger and ranking rules with tests                       |
| `db/migrations/`        | PostgreSQL schemas and operational constraints                   |
| `scripts/`              | Migration, seed, maintenance and blueprint generation            |
| `tests/`                | Workflow, concurrency, permission, media and browser tests       |
| `brand/`, `public/art/` | Matra identity, tokens, original demo illustrations              |
| `docs/`                 | Original strategy, audit, guidelines and user manual             |
| `site/`, `functions/`   | Existing Cloudflare Pages marketing site and waitlist            |

## Planning and audit

Start with [the MVP documentation audit](docs/07-MVP-AUDIT.md),
[the earlier system audit](docs/08-SYSTEM-AUDIT.md), and
[the implementation and verification record](docs/09-MVP-IMPLEMENTATION.md), and
[the branch audit and improvement plan](docs/10-BRANCH-AUDIT-IMPROVEMENT-PLAN.md).
The [UI/UX audit and improvement report](docs/11-UI-UX-AUDIT.md) records
desktop/mobile findings, screenshots, priorities, and acceptance criteria.
The original [ecosystem](docs/02-bdos-product-ecosystem.md),
[architecture](docs/03-architecture-and-stack.md),
[brand](docs/04-brand-system.md) and [roadmap](docs/06-roadmap-org-economics.md)
explain the long-term direction. Estimates and legal/tax assumptions require
independent validation before production use.

## Deployment distinction

The existing **bdos.io** Cloudflare Pages project serves `site/` from `main`.
Its `/blueprint` endpoint has a fail-closed password gate in
`functions/_middleware.js`; keep `BLUEPRINT_PASSWORD` configured.
The Node MVP is a separate service requiring PostgreSQL and persistent media
storage. A branch push does not deploy that service to the marketing domain.
Do not use a static export of the MVP or expose repository docs as public assets.

**Attention before commerce. Commerce before ads. Payouts before growth spend.**
