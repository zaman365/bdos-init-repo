# BDOS documentation audit and MVP contract

Audited 9 September 2026, branch `codex/ecosystem-mvp`. All six original documents,
brand assets, public site, and the pre-existing uncommitted SQL/money packages were reviewed.

## Findings

1. Docs 01–02 define six surfaces and a coherent content → purchase → creator income loop.
   They describe products, not executable acceptance criteria. This implementation turns
   the loop into persistent workflows and tests, with role-based access.
2. Doc 03 describes the destination architecture, including native Android/KMP, Go,
   Kubernetes, Kafka and several specialist databases. None is implemented in the initial
   repo. The MVP uses the specified Next.js/TypeScript web stack and PostgreSQL in a
   modular monolith. Native apps, distributed services and trained ML remain roadmap work.
3. Doc 04 is implementable now: Matra headings, brand tokens, money in gold, red reserved
   for LIVE, Bangla default and an English toggle. Art in this MVP is original SVG demo art.
4. Doc 05 contains legal and market assumptions, not verified current requirements. Tax
   rates, payment licences, music rights, age assurance and residency need specialist
   validation. The existing money package hardcodes illustrative 5% VAT and 10%
   withholding; those values are explicitly sandbox policy, never a compliance claim.
5. Doc 06 spans more than three years. Its staffing table sums to **134**, not the stated
   approximately 110. Category seed rates span 2.5–9%, wider than the 3–8% revenue estimate.
   These are planning inconsistencies, not reliable launch requirements. The MVP displays
   the actual category rate and treats affiliate commission as paid out of platform fees.
6. Existing SQL lacked application auth, comments, carts, uploads, permission checks,
   idempotent commands, and working services. Its journal trigger missed zero-line entries
   and allowed appending to old journals. Money multiplication could lose precision near
   the safe-integer limit. These are addressed in the MVP.
7. README claimed the blueprint was absent and required Access, while the committed route
   actually uses a fail-closed password gate. The public Pages deployment is preserved;
   the application is a separate Node service and never serves private docs/blueprint.

## MVP acceptance and boundary

| Surface | Implemented acceptance workflow | Boundary / later investment |
|---|---|---|
| BDOS | Phone OTP, profiles, ranked feed, following/mutuals, search aliases, reactions/comments, inbox, language/data-saver controls | Native Android/iOS, offline downloads, learned ranking and large-scale discovery |
| Cut | Upload image/video, trim, caption, product tag, draft, template/remix lineage, permission-controlled duet/stitch, publish, moderated visibility | Automatic Bangla ASR, translation, AR/green-screen compositing, licensed music marketplace |
| Shop | Catalog/variants/stock, cart checkout, COD and sandbox digital payment, buyer confirmation, fulfilment, delivery, return/refund, escrow, seller trust metric | Real PSP escrow and courier credentials, statutory tax rules, FBB warehouses |
| Studio | Own content/retention/earnings, 60/40 gifts, commission holds, verified payout destination, sandbox withdrawal, academy lessons and brand briefs | Sonar Fund paid rewards, recurring subscriptions, tax remittance, external settlements |
| Affiliate | Open/targeted/shop plans, sample approval/shipping, showcase, verified click attribution, no self attribution, commission clear/clawback | MCN settlement splits, device/address fraud ML |
| Ads | Creator Spark consent, campaigns/review/pause, separate labelled placements, capped density, prepaid budget, deduplicated impression/click/conversion events | Production ad exchange, off-site pixel/Events API and Sales Max models |
| LIVE | Browser camera broadcast over WebRTC for small rooms, chat, product anchors, gifts, host/end controls, age gate | TURN/RTMP/LL-HLS distribution, cohost/PK, audience scale |
| Trust/operations | Protective defaults, block/report, filtered comments/DMs, moderation reasons/appeal, seller/KYC review, partner leads, capped inbox notifications, audit log and feature switches | Trained multilingual moderation, human staffing, legal escalation operations |

Sandbox mode is opt-in. It is labelled in every screen and returns only sandbox provider
references. No production payment, payout, SMS or courier request is silently simulated
when sandbox is off. Browser camera permissions are required for LIVE; peer connectivity
outside a local network needs production TURN infrastructure.

## Validation strategy

Unit tests exercise integer money and balanced journals. PostgreSQL tests reject malformed
journals, unsafe transitions, unauthorised operations, double-spend and overselling.
Integration tests drive multiple user sessions through commerce, refund, affiliate, gifts,
payouts, safety and ads. Browser tests cover desktop/mobile navigation and user workflows.
A production build and TypeScript check are required before committing.
