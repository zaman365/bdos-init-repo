# BDOS ecosystem guidelines

Operating rules for building BDOS. Each document states rules with the reason
attached, because a rule whose reason is lost gets deleted by the next person
who finds it inconvenient.

| # | Guideline | Governs |
|---|---|---|
| [01](01-engineering.md) | Engineering | Code, APIs, errors, concurrency, testing, review |
| [02](02-product.md) | Product | What ships, in what order, and the gates between |
| [03](03-design.md) | Design | Brand application, UI rules, dual-script type, accessibility |
| [04](04-money.md) | Money | Paisa arithmetic, ledger invariants, escrow, tax, payouts |
| [05](05-trust-safety.md) | Trust & Safety | Moderation, Nirapod, enforcement, escalation |
| [06](06-data-privacy.md) | Data & privacy | PII, residency, retention, KYC, what we refuse to collect |
| [07](07-ranking.md) | Ranking | What the feed optimises, and what it must never optimise |
| [08](08-operations.md) | Operations | Runbook, reconciliation, on-call, multi-agent hygiene |

## The three rules that outrank everything below

1. **Attention before commerce, commerce before ads, payouts before growth spend.**
   A feed with no supply cannot sell anything. A shop with broken payouts loses
   its sellers permanently. Ads sold against thin inventory poison the
   advertiser relationship for years.

2. **Every feature must make one arrow of the loop turn faster.**
   Creator → viewer → seller → affiliate → creator. If a proposal accelerates
   no arrow, it does not ship, however good it is.

3. **A promise in the product is a constraint in the code.**
   We tell creators their video gets a real audition and that they keep 60% of
   every gift. Those are enforced structurally — a reserved share of feed slots,
   a policy constant in the ledger — not by a tunable weight someone can lower
   in a config change. See [07](07-ranking.md) and [04](04-money.md).

## Status of the codebase against these guidelines

See [the branch audit and improvement plan](../10-BRANCH-AUDIT-IMPROVEMENT-PLAN.md)
for the current implementation and verification record. The earlier system audit
is a historical snapshot. The web MVP has working screens and tested application
workflows; the plan identifies separate production launch dependencies.
