# 08 — Operations guidelines

## Reconciliation

The production nightly job must assert `ledger.trial_balance.drift_paisa = 0` and reconciles
internal journals against gateway, MFS and courier settlement files. Drift
pages a human; it is never auto-corrected.

**A zero trial balance is not proof of bank cash.** It proves the book is
internally consistent. Only reconciliation against an external statement
proves money exists — see [04](04-money.md).

Corrections are **reversing entries**, never edits. The schema enforces this:
`journal_entry` and `journal_line` reject `UPDATE` and `DELETE` by trigger.

## What pages someone

| Signal | Why it is urgent |
|---|---|
| Trial balance drift ≠ 0 | The book is wrong; every downstream number is suspect |
| Payout success rate < 99.5% | A launch gate, and creator trust is not recoverable |
| Escrow released without delivery confirmation | Legal exposure under the 2021 rules |
| A `communal_religious` case unactioned > 15 min | Physical-safety risk, not a content queue |
| RTO rate rising in a district | Courier failure; reassign the route |
| Feed audition backlog growing | The cold-start promise is silently breaking |

## Runbook essentials

- **Normal application migrations:** `npm run db:migrate` (preserves data)
- **Explicit local reset:** `./db/apply.sh --reset bdos_dev` (destroys that database)
- Without `--reset`, `db/apply.sh` only creates a new `bdos_*` database and refuses an existing one.
- **Verify invariants:** `npm run db:test` — 17 assertions in a unique disposable PostgreSQL database
- **Verify logic:** `npm test` — money, ledger, ranking packages
- **Full gate:** `npm run verify` (typecheck + package/client/integration tests + build)
- **Browser gate:** `npm run test:e2e` (desktop/mobile, navigation and lost-response recovery)
- **Maintenance:** `npm run maintenance` clears due commissions, prunes supported
  transient records and reports/audits affected counts. Financial history is retained.
- Kill switches exist per surface via `app.flag`. Pausing uploads or checkout
  is a database row, not a deploy.

## Capacity

Plan backwards from **Ramadan and Eid-ul-Fitr** — the annual peak. Then
Eid-ul-Adha, Pohela Boishakh, Durga Puja, winter weddings, and the imported
11.11 / 12.12 moments. A platform that misses its first Eid waits a year for
another one.

## Multi-agent and shared-tree hygiene

Learned the hard way during the audit on 9 September 2026, when two agents
edited this working tree simultaneously. All three of these cost real time:

1. **Never `git add -A` on a shared tree.** Stage explicit paths. A blanket add
   swept another agent's in-progress files — including a `Shell.tsx` that did
   not parse — into committed history.
2. **A parse error anywhere blinds `tsc` everywhere.** One `TS1005` suppressed
   every semantic error in the project, so a "clean" typecheck meant nothing.
   Confirm the tree parses before trusting it.
3. **Re-read the source at the moment you test it.** A fix was written against
   `splitBp`, the file was rewritten underneath by the other agent, and the
   resulting green test proved nothing about the code under review. It also
   produced a wrong audit finding that had to be retracted.

Partition ownership by directory — one agent in `app/`, another in `packages/`
and `db/` — or give each agent its own git worktree. Two agents in one tree is
not a workflow.

## Deployment

The public site (`site/`) deploys to Cloudflare Pages from `main`; application
branches do not touch it. `/blueprint` is gated by a fail-closed password
middleware — with no `BLUEPRINT_PASSWORD` set it returns 503 rather than the
document, so an unconfigured deploy cannot leak internal strategy.
