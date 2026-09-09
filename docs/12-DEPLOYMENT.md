# 12 — Deployment

## What bdos.io serves today

| URL | Serves | Where from |
|---|---|---|
| `https://bdos.io/` | Public landing page + waitlist | Cloudflare Pages project `bdos`, built from `main`, output dir `site/` |
| `https://bdos.io/blueprint` | The ecosystem blueprint | Same project, gated by `functions/_middleware.js` — fail-closed on `BLUEPRINT_PASSWORD` |
| `POST /api/waitlist` | Waitlist signup | Pages Function writing to KV namespace `bdos-waitlist` |

This is live and working. **Nothing in this document should break it.**

## Why the MVP application cannot go on Cloudflare

The Next.js app is not edge-deployable. It imports, and needs:

- `node:fs/promises` — `lib/media.ts` writes uploads to `MEDIA_DIR` on disk.
- `node:child_process` — transcoding shells out to ffmpeg for the 480p rung.

Cloudflare Workers and Pages Functions provide neither a writable filesystem
nor process execution, so `@opennextjs/cloudflare` will not rescue this. There
is also no Cloudflare PostgreSQL: D1 is SQLite and incompatible with this
schema (8 schemas, enums, `bigserial`, constraint triggers, plpgsql).

The app needs a **container or VM host running Node 22, plus managed
PostgreSQL 17**.

## Verified so far

- `docker build` succeeds from the committed `Dockerfile`.
- The app boots and answers `GET /api/health` with `200 {"ok":true,...}` against
  a real PostgreSQL 17 instance.
- `tsc` clean; 102 package + integration tests pass; 17 database invariants pass.

Not yet verified: a full `compose.yaml` bring-up on this machine, because the
local Docker credential helper (`docker-credential-desktop`) is missing from
`PATH` and blocks image pulls. That is an environment fault, not a repository
one.

## The one setting that decides whether a deploy is safe

`BDOS_SANDBOX` is not a convenience flag.

| Value | Consequence |
|---|---|
| `true` | `POST /api/auth/request` returns the OTP **in the response body**. Anyone can sign in as any phone number. This is a complete authentication bypass and must never be set on a public host |
| `false` | Auth works properly via `SMS_WEBHOOK_URL`. Checkout, payouts, couriers and ad billing return `503 "not configured"` until real providers are wired — by design, so the platform never fakes money outside the sandbox |

So a public deploy today is either a fake-money sandbox with an auth bypass, or
a browsable app whose commerce paths are switched off. **Neither is a launch.**
That is the honest state: the MVP is complete as a workflow demonstration, not
as a transacting business.

## Recommended topology

Keep the working landing page where it is and put the app on a subdomain:

```
bdos.io          → Cloudflare Pages (static landing, unchanged)
app.bdos.io      → CNAME (proxied) → Node host running this container
```

This means a bad app deploy can never take down the marketing site, and the
app can be gated independently.

## Required environment

```
DATABASE_URL=postgresql://user:pass@host:5432/bdos      # managed PostgreSQL 17
APP_ORIGIN=https://app.bdos.io                          # must be https in production
AUTH_SECRET=<32+ random characters>                     # HMAC key for OTP hashing
BDOS_SANDBOX=false                                      # see the table above
MEDIA_DIR=/data/media                                   # must be a persistent volume
FFMPEG_PATH=bundled                                     # uses the ffmpeg-static dependency
SMS_WEBHOOK_URL=https://<your sms adapter>/send         # required when not sandboxed
SMS_WEBHOOK_TOKEN=<bearer token>
```

Generate the secret with `openssl rand -hex 32`. It is a real credential:
set it in the host's secret store, never in the repository.

## Deploy steps

1. **Provision** a container host and a managed PostgreSQL 17 instance. Attach
   a persistent volume for `MEDIA_DIR` — uploads are on disk, so a stateless
   filesystem loses them on every restart.
2. **Set** the environment above as host secrets.
3. **Migrate** as a release command, before the new version takes traffic:
   `npm run db:migrate`. Do **not** run `npm run db:seed` against production —
   it calls `requireSandbox()` and will refuse, which is the intended
   behaviour.
4. **Deploy** the image. `CMD` is `npm run start`; `tini` is the entrypoint so
   SIGTERM drains in-flight requests. The `HEALTHCHECK` hits `/api/health`,
   which verifies database connectivity, so point the host's readiness probe
   at the same path.
5. **DNS**: in Cloudflare, add a proxied `CNAME` for `app` pointing at the
   host. Leave the apex record alone — it belongs to the Pages project.
6. **Gate it** while it is a preview: Cloudflare Access on `app.bdos.io`, or
   keep it on the host's own URL until the providers below are contracted.

## Before it can be a public, transacting deployment

These are contractual and legal, not engineering:

- A licensed payment operator (PSO/PSP) and a designated escrow account —
  holding customer funds requires this. See `docs/05` §4.
- An SMS provider for OTP delivery.
- Courier API credentials for at least three partners.
- Verified tax configuration. The 5% VAT and 10% withholding in
  `packages/ledger` are **illustrative sandbox policy**, not tax advice — see
  `docs/guidelines/04-money.md`.
- Music licences before any sounds library ships.
- Reconciliation against external settlement statements. A zero trial balance
  proves the book is self-consistent, never that the money exists.

## Rollback

Images are immutable; redeploy the previous tag. Migrations are additive and
forward-only — there are no down migrations, by design, because a down
migration that drops a ledger column is a data-loss weapon. To reverse a
financial mistake, post a reversing entry; the schema rejects `UPDATE` and
`DELETE` on journals.
