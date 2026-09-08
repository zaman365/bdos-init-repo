# 06 — Roadmap, Org & Economics

Sequencing rule, restated because it is the plan's spine:
**attention before commerce · commerce before ads · payouts before growth spend.**

---

## 1. Phases and their gates

A phase does not end on a date. It ends when its gate is met.

### P0 · Foundation — months 0–4
Company, licences and PSP partnership started · brand and design system · Kubernetes
footprint (in-country DC + cloud burst) · identity and phone auth · the full
upload → transcode → deliver → play path · closed alpha with 100 hand-picked Dhaka creators.
**Gate:** those 100 creators post three times a week without being asked.

### P1 · Attention — months 5–10
Public Android launch. For You and Following · BDOS Cut editor with templates, duet, stitch ·
licensed sounds library · Bangla auto-captions · Nirapod v1 · Bangla/Banglish moderation v1 ·
Sonar Fund pilot.
**Gate:** D30 retention ≥ 25%, 45+ minutes per DAU, 20k weekly active creators.

### P2 · Commerce — months 11–16
BDOS Shop and Seller Center · escrow ledger · COD + MFS + cards · courier abstraction with
three partners live · product tags inside the editor · Affiliate v1 with sample requests ·
Bharosha seller score.
**Gate:** RTO under 25%, commission ledger reconciles to the paisa, seller repeat-listing
rate holding.

### P3 · Live & scale — months 17–22
BDOS LIVE with published gift splits · LIVE shopping · iOS · web surfaces · Partner Network
for SME onboarding · Fulfilled by BDOS pilot in Dhaka.
**Gate:** creator payout success ≥ 99.5%, positive gifting revenue per live hour.

### P4 · Margin — months 23–30
BDOS Ads self-serve · Spark-style promotion of organic creator posts · pixel and server-side
events · automated Sales Max campaigns · nationwide category expansion.
**Gate:** advertiser 90-day repeat spend rate.

### P5 · Platform — year 3+
AI creative suite · BNPL and seller credit with an NBFI partner · diaspora cross-border
(Bangladeshi goods to the UK, US and Gulf) · open APIs and a developer platform.

## 2. Organisation at end of P2 (~110 people)

| Function | Heads | Note |
|---|---|---|
| Trust & Safety | 28 | Largest team by year two. 24/7, in-house, Bangla + dialects |
| Backend | 22 | Go services, ledger, commerce |
| Client | 18 | Android 10 · iOS 3 · Web 5 |
| Seller & category ops | 12 | Field-heavy, outside Dhaka |
| ML & data | 12 | Ranking, moderation models, Bangla NLP/ASR |
| Infra, SRE, security | 10 | Hybrid DC + cloud, CDN/BDIX relationships |
| Creator ops | 10 | The recruiting and retention engine for supply |
| Product & design | 14 | Includes content design and localisation |
| Finance, legal, compliance | 8 | Escrow, tax withholding, regulatory |

In-house moderation is a deliberate cost choice. Outsourced English-first moderation cannot
read Sylheti harassment, and getting this wrong is an existential brand risk, not a
quality-of-service issue.

## 3. Revenue lines

1. **Commission on GMV** — 3–8% by category (beauty high, electronics low).
2. **LIVE gifting** — platform keeps 40%, creator 60%. Deliberately more generous than the
   market standard and stated publicly; it is a supply-recruitment argument.
3. **Ads** — CPM, CPC and CPA inventory, from P4.
4. **Fulfilment and logistics margin** — from FBB.
5. **Seller services** — promoted listings, storefronts, analytics tiers.
6. **Later** — credit and BNPL referral economics, insights products.

## 4. Unit economics — an illustrative model, not a forecast

| Line | Assumption |
|---|---|
| AOV | ৳1,400 |
| Seller commission | 6% → ৳84 |
| Affiliate commission (paid from that) | up to 4% → platform net ≈ ৳45 |
| COD RTO | 25% → net revenue per *shipped* order ≈ ৳34 before RTO courier cost |
| Paid CAC target | under ৳120, with affiliate-driven acquisition priced at commission (paid only on success) |
| Repeat rate target | 6 orders per active buyer per year |

Two levers dominate everything in that table: **RTO** and **delivery cost**. A five-point RTO
improvement is worth more than any pricing change we could make.

On the content side, the equivalent lever is **delivery cost per 1,000 seconds watched**.
On-net BDIX/ISP-cached delivery is a large multiple cheaper than international transit —
which is why peering is a P0 workstream and not an optimisation for later.

## 5. Principal risks

| Risk | Response |
|---|---|
| Content-law exposure and takedown pressure | Published Bangla policy, logged legal review, transparency report, local policy council |
| Incumbent gravity (Facebook / TikTok) | Do not fight on general social. Win where they are weak: seller tooling, escrow trust, payouts that work, women's safety |
| COD fraud and RTO | Prepaid delivery fee, OTP-before-dispatch, buyer trust score, address scoring |
| Affiliate and review fraud | Device and address clustering, velocity limits, hold periods, clawbacks |
| Moderation failure going viral | Human-in-the-loop for high-reach content, fast escalation, honest post-mortems |
| Music licensing gaps | Label-by-label deals before launch; a legally clean sounds library or none |
| Capital intensity | Phase spend against gates; ads and fulfilment deferred until the loop is proven |

## 6. What would make this fail fastest

Launching commerce before the feed has supply. Paying for growth before withdrawals to bKash
work reliably. Treating moderation as a vendor line item. Setting Bangla in Roboto.
