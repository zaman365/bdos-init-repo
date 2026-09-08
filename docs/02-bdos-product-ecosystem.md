# 02 — The BDOS Ecosystem

**BDOS** — *Bangladesh On Stage*. Pronounced "BEE-doss". Bangla: **বিডস**.
One app, six surfaces, one loop: **দেখো · কিনো · কামাও** — Watch · Buy · Earn.

---

## 1. The loop

```
        content that earns attention
   creator ─────────────────────────► viewer
      ▲                                  │
      │ commission / gifts / rewards     │ purchase
      │                                  ▼
   affiliate ◄──── product + sample ─── seller
      ▲                                  │
      └────── ads amplify what works ────┘
```

Every surface below exists to make one arrow of that loop turn faster. If a proposed feature
doesn't accelerate an arrow, it doesn't ship.

## 2. The six surfaces

### S1 · BDOS (the app) — attention
For You · Following · **Pashe** (Friends — mutuals only) · Search · LIVE tab · Shop tab ·
Inbox · Profile. Photo/carousel posts as first-class (data-cheap, and enormously popular in
BD). Comments as a second content layer with pinned creator replies.

Bangladesh-specific from day one:
- **Data Saver** is a top-level toggle, not buried in settings. Default 480p on cellular.
- Bangla-first UI with instant script toggle (Bangla / English / Banglish transliteration
  search — people type "kacchi" and "কাচ্চি" interchangeably and both must work).
- Autoplay respects metered connections; downloads for offline are explicit.
- APK under 40MB, Android 8+ target, cold start under 2s on a 2GB-RAM device.

### S2 · BDOS Cut — creation
The editor, shipped as a first-class product (CapCut's role).
Templates (one-tap trend participation) · Sounds library · Duet · Stitch · auto-captions in
Bangla · auto-translate · green screen · **product-tag while editing** (the commerce hook
lives in the creation flow, not after it) · AR effects via **BDOS Effects** SDK.

### S3 · BDOS Shop — commerce
Seller Center · catalog + variants · video/LIVE product anchors · Shop tab ·
**Bharosha score** (public seller trust score: fulfilment speed, return rate, dispute
outcomes) · vouchers, flash deals, Eid/Boishakh campaign calendar ·
**Fulfilled by BDOS (FBB)** from phase 3 · returns, refunds, disputes ·
**BDOS Partner Network** — accredited agencies that onboard and operate SMEs in
Bogura, Narsingdi, Sylhet, Khulna, where our own team will never be.

### S4 · BDOS Studio — creators
Analytics (retention curves, traffic sources, earnings) ·
**Sonar Fund** — retention-weighted creator rewards, published RPM bands ·
LIVE gifting with a **published split** (creator 60 / platform 40 at launch — deliberately
better than the market, and a headline recruiting message) ·
Subscriptions and tips · **Creator Marketplace** for brand deals ·
**BDOS Academy** — Bangla-language video curriculum, the retention tool for supply.

Gift catalog is culturally native, not a generic rose: **Shapla** (৳10), **Rickshaw** (৳50),
**Nauka** (৳100), **Ilish** (৳500), **Kacchi** (৳1,000), **Royal Bengal** (৳5,000),
**Padma Setu** (৳20,000). This is the kind of detail that makes a platform feel like *ours*.

### S5 · BDOS Affiliate — the growth engine
Open plan · targeted plan · shop-wide plan · **sample requests** (seller ships free product
to a vetted creator) · Showcase storefront · commission ledger with a visible hold period
tied to the return window · MCN/agency accounts · fraud controls (self-purchase detection,
device/ address clustering, velocity rules).

Affiliate is how BDOS acquires customers at a price it only pays on success. Budget it as
CAC, not as a feature.

### S6 · BDOS Ads — margin
Self-serve Ads Manager · objectives from reach to product sales · **Spark**-style promotion
of organic creator posts (with permission and revenue share) · branded effects and
challenges · pixel + server-side events for off-platform advertisers · automated
"Sales Max" campaigns once there is enough conversion data to train on.

Ads launch *last*. Selling inventory before the feed is dense and the attribution is honest
burns advertiser trust that takes years to rebuild.

## 3. Cross-cutting systems

| System | What it owns |
|---|---|
| **Identity** | Phone-first auth (OTP), NID/TIN verification for sellers and payouts, age assurance |
| **Ledger** | Double-entry, append-only: orders, escrow, commissions, gifts, payouts, refunds |
| **Ranking** | Retrieval + multi-task ranking for video, products, search, ads |
| **Trust & Safety** | Bangla/Banglish/dialect moderation, appeals, seller & IP enforcement |
| **Nirapod** | Safety layer: comment filters, DM controls, one-tap block+report+mute, private-by-default options, harassment clustering |
| **Growth** | Referrals, campaign calendar, notification budget (a hard per-user daily cap) |

**Nirapod** deserves emphasis. Harassment of women online is the single biggest reason a
Bangladeshi creator quits. A platform that visibly protects women creators wins the supply
side of the market. This is a product strategy, not a CSR line.

## 4. Personas we build for

- **Rifat, 19, Rajshahi.** ৳400/month prepaid data, 3GB. Redmi A2. Watches 40 min/day on the
  bus. Will not tolerate a 90MB app or an autoplaying 1080p feed.
- **Nusrat, 24, Dhaka.** 80k followers doing skincare content. Earns nothing today. Wants
  predictable income and to not be harassed in her comments.
- **Shakib, 27, Cumilla.** Full-time job, promotes gadgets in the evening. Needs a commission
  ledger he trusts and a withdrawal to bKash that lands.
- **Bogura SME.** Sells kurtis on Facebook Live with a paper notebook for orders. Needs
  order management more than it needs a storefront.
- **Brand manager, FMCG.** Has TV budget, needs proof of digital ROI in a format finance
  accepts.

## 5. Launch sequencing rule

Attention before commerce. Commerce before ads. Payouts before growth spend.
A feed with no supply cannot sell anything; a shop with broken payouts loses its sellers
permanently; ads sold against thin inventory poison the advertiser relationship.
