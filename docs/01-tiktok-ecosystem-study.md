# 01 — The TikTok Ecosystem, Taken Apart

Purpose: understand *why* TikTok works structurally, so BDOS copies the mechanics and not
the screenshots. Everything below is the reference model we build against.

---

## 1. The core inversion: interest graph, not social graph

Every social product before TikTok answered "what did the people you follow post?".
TikTok answers "what will *you* watch next?" — and it answers it for a brand-new account
within roughly 5–10 videos of signal (watch time, completion, replay, share, skip speed).

Three consequences that define the whole ecosystem:

| Consequence | Why it matters commercially |
|---|---|
| A creator with 0 followers can get 1M views | Supply grows without a follower-acquisition grind → content volume explodes |
| Distribution is re-earned per video | No permanent aristocracy; the feed stays fresh; creators stay hungry |
| The feed is *one* ranked surface | Anything you can rank, you can inject — including products and ads |

That third point is the entire commerce thesis. TikTok Shop is not a store bolted onto a
video app. It is **the same ranked feed, with SKUs as first-class rankable objects.**

## 2. Creation tools are distribution primitives

Sounds, templates, Duet, Stitch, effects and green-screen are not "editing features". Each
one is a *replication mechanism* — a way for one idea to spawn a thousand variants, each of
which is new inventory for the feed.

- **A sound** is a joinable format. Tap it → see every video using it → make yours.
- **Duet / Stitch** turn consumption into production; the reply is itself content.
- **Templates** collapse the skill floor: a first-time creator ships a competent video in 90s.
- **CapCut** sits *outside* the app but feeds it — the editor is a moat, not an accessory.
- **Effect House** externalises AR production to a developer community.

Lesson for BDOS: ship the editor as a first-class product, not a camera screen.

## 3. The value ladder: Content → Commerce → Ads

TikTok monetises the same attention three times, in increasing order of margin certainty:

1. **Organic content** proves what people want (free demand signal).
2. **Affiliate commerce** converts that signal into GMV with zero platform inventory risk;
   the creator's commission *is* the customer-acquisition cost, paid only on success.
3. **Ads** let a brand buy more of exactly what already worked — and **Spark Ads**
   (promoting an organic creator post, with its real comments and likes intact) closes the
   loop by making the ad indistinguishable from the content that earned attention honestly.

GMV Max / Smart+ then automate the whole ladder: the seller sets a target, the system picks
creatives (including creator videos), audiences and bids.

## 4. The five products that make up "TikTok"

### 4.1 The consumer app
For You · Following/Friends · Search (a genuine discovery engine for under-25s) ·
Explore · LIVE · Inbox/DM · Profile · Shop tab · Photo mode · comment threads as a
second content layer (comments are a huge share of session time).

### 4.2 The creator economy
- **Creator Rewards** — RPM-style payment on qualified views (>1 min, original content).
  Note the design: it pays *retention*, not raw views, because raw views reward clickbait.
- **LIVE gifting** — viewers buy coins → send gifts → creator receives diamonds → cash out.
  Platform keeps roughly half. In South and Southeast Asia this is frequently *larger* than
  ad revenue share for mid-tier creators.
- **Subscriptions, Tips, Series** — direct fan payment.
- **Pulse** — ad revenue share against premium content inventory.
- **Creator Marketplace / TikTok One** — brand-to-creator matchmaking, briefs, deliverables.
- **Creator Academy** — education as a retention mechanism for supply.

### 4.3 TikTok Shop
Seller Center · product catalog · shoppable video anchors · LIVE shopping · Shop tab ·
Mall (brand stores) · vouchers/flash sales · Fulfilled by TikTok (FBT) · returns and refunds
· seller scorecards and penalties · Shop Academy · **TikTok Shop Partners (TSP)** — an
agency layer that onboards and operates sellers the platform can't service directly.

### 4.4 The affiliate engine (the part most clones miss)
- **Open plan** — any creator can promote any enrolled product at a set commission.
- **Targeted plan** — seller invites specific creators at a higher rate.
- **Shop plan** — creator-wide commission across a seller's catalog.
- **Sample requests** — sellers ship free product to creators; the single highest-leverage
  supply mechanic in the whole system.
- **Showcase** — the creator's own storefront of promoted goods.
- **MCNs/agencies** — aggregate creators, guarantee output, take a cut.
Attribution, commission ledgers, hold periods (commission clears only after the return
window closes) and fraud controls are the unglamorous core.

### 4.5 Ads
Ads Manager · objectives (reach → traffic → conversion → product sales) · Spark Ads ·
TopView/takeovers · Branded Effects and Hashtag Challenges · Pixel + Events API ·
automated campaigns (Smart+/GMV Max) · Symphony (generative creative).

## 5. What holds it together: trust, or the lack of it

The costs nobody budgets for on the first pass:
- Content moderation at UGC scale (automated classifiers + human review + appeals), in every
  language *and dialect and transliteration* the audience actually uses.
- Age assurance — LIVE and gifting are 18+; the feed is 13+.
- Seller verification, counterfeit and IP enforcement, review fraud.
- Payment fraud, affiliate fraud (self-purchase, fake attribution), gift-money laundering.
- Regulatory pressure: data residency, takedown regimes, ad transparency, minors' safety.

Moderation is not a compliance line item. It is a **core platform system** with its own
data pipeline, model stack, tooling, staffing and SLAs — and in a market like Bangladesh it
is also the difference between a platform women will use and one they won't.

## 6. The eight mechanics BDOS must reproduce

1. Cold-start distribution — any video can win; new creators get a real audition.
2. Retention-weighted ranking — pay and rank on watch quality, not impressions.
3. Replication formats — sounds, templates, duet/stitch as native primitives.
4. Products as rankable objects in the same feed, not a separate mall.
5. Affiliate as performance-priced CAC, with a trustworthy commission ledger.
6. Live as the conversion surface, with gifting as the creator's second income line.
7. Spark-style promotion so paid amplifies what organic already validated.
8. A partner/agency layer, because a platform cannot onboard 50,000 SMEs by itself.

## 7. What we deliberately do NOT copy

- **Coin/diamond opacity.** TikTok's gift economics are famously hard to reason about. BDOS
  publishes the split on every gift. Transparency is cheap and it buys creator loyalty.
- **Black-box strikes.** Every enforcement action gets a plain-Bangla reason and one appeal.
- **Cross-border-first commerce.** Bangladesh's FX and customs reality makes a China-style
  cross-border catalog a legal and logistical trap at launch. Domestic supply first.
- **Growth before payouts work.** If creator withdrawals to bKash fail, supply leaves and
  never comes back. The ledger ships before the growth budget does.
