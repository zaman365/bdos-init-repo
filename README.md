# BDOS — বিডস

**Bangladesh On Stage.** A short-video, creator, affiliate and social-commerce ecosystem
built for Bangladesh: Android-first, Bangla-first, escrow-native, payout-obsessive.

> **দেখো · কিনো · কামাও** — Watch · Buy · Earn.

This repository currently holds the plan and the brand system. Start here:

| Document | What's in it |
|---|---|
| [docs/01-tiktok-ecosystem-study.md](docs/01-tiktok-ecosystem-study.md) | TikTok taken apart: the interest graph, creation as replication, the content→commerce→ads ladder, and the eight mechanics BDOS must reproduce |
| [docs/02-bdos-product-ecosystem.md](docs/02-bdos-product-ecosystem.md) | The loop, the six surfaces, cross-cutting systems, personas |
| [docs/03-architecture-and-stack.md](docs/03-architecture-and-stack.md) | Every stack decision with the alternative we rejected; video pipeline, ranking, the ledger |
| [docs/04-brand-system.md](docs/04-brand-system.md) | The Matra identity, colour, dual-script typography, voice, gifts, sound |
| [docs/05-bangladesh-operating-reality.md](docs/05-bangladesh-operating-reality.md) | COD and RTO, MFS payouts, escrow law, language, the commerce calendar, Nirapod |
| [docs/06-roadmap-org-economics.md](docs/06-roadmap-org-economics.md) | Phases and their gates, org shape, revenue lines, unit economics, risks |
| [bdos-ecosystem.html](bdos-ecosystem.html) | One-page summary of the whole ecosystem |
| [brand/](brand/) | Design tokens (CSS + JSON), icon and wordmark |

## Deployment

Live at **https://bdos.io** via Cloudflare Pages (project `bdos`), auto-deployed from
`main`. Pages settings: no build command, build output directory `site`.

| Path | What | Exposure |
|---|---|---|
| `site/index.html` | Public landing page + waitlist | Public |
| `site/404.html` | Branded not-found page | Public |
| `functions/api/waitlist.js` | Waitlist endpoint, writes to the `WAITLIST` KV binding (namespace `bdos-waitlist`) | Public POST |
| `site/blueprint/index.html` | The full ecosystem blueprint | **Gated — do not deploy ungated** |

`site/blueprint/index.html` is generated from the canonical `bdos-ecosystem.html`:

```
python3 scripts/build-blueprint.py
```

It holds take rates, unit economics, org headcount and the risk register, so it must
only be served behind Cloudflare Access. It is deliberately absent from `site/` until
that gate exists.

## Guidelines

Operating rules, each stating the reason alongside the rule — see
[docs/guidelines/](docs/guidelines/00-INDEX.md).

| # | Guideline | Governs |
|---|---|---|
| 01 | [Engineering](docs/guidelines/01-engineering.md) | Code, APIs, errors, concurrency, testing, review |
| 02 | [Product](docs/guidelines/02-product.md) | What ships, in what order, and the gates between |
| 03 | [Design](docs/guidelines/03-design.md) | Brand application, UI rules, dual-script type, accessibility |
| 04 | [Money](docs/guidelines/04-money.md) | Paisa arithmetic, ledger invariants, escrow, tax, payouts |
| 05 | [Trust & Safety](docs/guidelines/05-trust-safety.md) | Moderation, Nirapod, enforcement, escalation |
| 06 | [Data & privacy](docs/guidelines/06-data-privacy.md) | PII, residency, retention, KYC, what we refuse to collect |
| 07 | [Ranking](docs/guidelines/07-ranking.md) | What the feed optimises, and what it must never optimise |
| 08 | [Operations](docs/guidelines/08-operations.md) | Runbook, reconciliation, on-call, multi-agent hygiene |

Current gap list against these rules: [docs/08-SYSTEM-AUDIT.md](docs/08-SYSTEM-AUDIT.md).

## Verify

```
npm run verify      # typecheck + package tests + database invariants
./db/apply.sh       # rebuild a local database from migrations
./db/test.sh        # 17 ledger/commerce invariants against real PostgreSQL
```

**Sequencing rule:** attention before commerce · commerce before ads · payouts before growth spend.

All market figures in these documents are planning estimates, and all legal points need
counsel's confirmation before they drive a decision.
