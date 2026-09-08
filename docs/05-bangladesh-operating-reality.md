# 05 — Bangladesh Operating Reality

Everything here is a constraint that changes the product, not background colour.
**All figures are planning estimates and all legal points need counsel's confirmation
before they drive a decision.**

---

## 1. The market shape

- ~171M people, median age around 27 — one of the youngest large populations in Asia.
- Internet access is overwhelmingly mobile; Android dominates the handset base, skewed to
  entry-level devices with 2–4GB RAM.
- Prepaid data is bought in small packs. Users ration megabytes consciously — a heavy app
  is not an inconvenience, it is a reason to uninstall.
- Facebook is the incumbent for both social and commerce; a very large informal
  "F-commerce" seller base runs on Messenger, comments and paper notebooks.
- Formal e-commerce GMV is still small relative to retail — the opportunity is converting
  informal sellers, not stealing formal ones.

**What this means:** the competitor is not another video app. It is a Facebook Live session
with orders taken in the comments and a courier called manually.

## 2. Payments

| Rail | Role in BDOS |
|---|---|
| **Cash on delivery** | Still the majority of orders. Must be first-class, not a fallback |
| **bKash / Nagad / Rocket / Upay** | Consumer payment in, and the *only* payout method creators trust |
| **Cards** | Small share, higher AOV, needed for advertisers |
| **Gateways** (SSLCommerz, ShurjoPay, aamarPay, bKash PGW) | Aggregation, escrow mechanics |
| **BEFTN / RTGS** | Seller and large creator settlement to bank accounts |

Two hard consequences:

1. **COD forces an RTO strategy.** Return-to-origin on COD orders runs high enough to erase
   category margin. Countermeasures, in order of impact: prepaid delivery fee on first
   orders, OTP confirmation before dispatch, buyer trust scoring, address quality scoring,
   prepaid incentives (free delivery, cashback), and blocking repeat refusers.
2. **Payout reliability is a growth channel.** A creator whose first ৳500 lands in bKash the
   day it clears tells ten creators. One failed withdrawal ends the relationship.

## 3. Logistics

Third-party couriers (Pathao Courier, Steadfast, RedX, Paperfly, eCourier, Sundarban and
regional operators) rather than own fleet at launch. Build a **courier abstraction layer**
from day one: one internal shipment API, pluggable adapters, per-route performance scoring,
automatic reassignment when a partner's success rate drops in a district. Own fulfilment
(FBB) only after a category proves volume density.

## 4. Regulation — the parts that shape the build

*Verify each with counsel; rules in this space change often.*

- **Digital Commerce Operation Guidelines (2021 and amendments).** The defining rule:
  customer money is held and released to the seller against delivery confirmation. Delivery
  and refund windows are prescribed. Sellers need digital business registration (DBID).
  This is a direct response to the 2021 marketplace collapses — treat it as the moral core
  of the product, not red tape. **Escrow is architecture, not a feature.**
- **Bangladesh Bank.** Holding customer funds requires a licensed payment operator. Plan to
  operate through a licensed PSO/PSP partner with a designated escrow account. Cross-border
  settlement and outward remittance are restricted — **creator payouts settle in BDT,
  domestically.** A coin/gift balance must be structured as prepaid digital goods, never as
  a transferable payment instrument.
- **NBR / tax.** VAT registration (BIN), VAT on marketplace commission and delivery, source
  tax withheld on creator and affiliate payments, Mushak documentation. Withholding must be
  computed inside the ledger and shown on the creator's statement.
- **Content law.** The Cyber Security Act 2023 regime and BTRC directives create real
  takedown and liability exposure. Requirements: a documented, published content policy in
  Bangla; a logged takedown workflow with legal review; a transparency report; and a local
  policy council for religiously and politically sensitive escalations. Blasphemy and
  communal accusations can move from a comment thread to physical violence — the escalation
  path for that category is a safety system, not a moderation queue.
- **Data protection.** Assume in-country storage obligations for personal data and design
  for it now: KYC and payment data in an in-country vault with access audit.
- **Music.** Bangla music licensing must be negotiated label by label plus a collecting
  society arrangement. The sounds library is a legal project before it is a product feature.
- **Corporate.** RJSC company, BIDA registration for foreign investment, trade licence,
  TIN/BIN, e-CAB membership.

## 5. Language

Bangla-first is not a translation task.
- The UI ships in Bangla with an English toggle; Bangla is the default.
- Search must handle Bangla script, English, and **Banglish** transliteration in one index.
- Moderation models need Bangla, Banglish, and the major dialects — Sylheti, Chittagonian,
  Noakhali, Barishali — plus the coded language harassment actually uses. Off-the-shelf
  English classifiers will pass abuse straight through.
- ASR for auto-captions in Bangla is a genuine engineering investment; it is also an
  accessibility and a watch-time win (sound-off viewing on the bus).

## 6. The commerce calendar

Ramadan and Eid-ul-Fitr are the peak — plan capacity, seller onboarding and creator
campaigns backwards from it. Then Eid-ul-Adha, Pohela Boishakh (14 April), Durga Puja, the
winter wedding season, and the imported 11.11 / 12.12 moments. A platform that misses its
first Eid waits a year for another one.

## 7. Trust, specifically for women

Harassment is the main reason women creators stop posting in Bangladesh. **Nirapod** is the
answer and it is a differentiator, not a checkbox: comment filtering tuned for Bangla and
Banglish abuse, DM permissions off by default, one-tap block-report-mute-and-hide-history,
harassment clustering that catches brigading across accounts, restricted duet/stitch
defaults, and a named human escalation path. Winning the trust of women creators wins the
supply side of this market outright.
