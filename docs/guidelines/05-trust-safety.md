# 05 — Trust & Safety guidelines

Moderation is a core platform system with its own data model, pipeline,
staffing and SLAs. It is not a support queue and not a vendor line item.

## Why this is in-house

Outsourced English-first moderation cannot read Sylheti harassment. The
categories that matter most here — communal accusations, coded misogyny,
religious incitement — are invisible to a classifier trained on English
Twitter. Getting this wrong is an existential brand risk, which is why T&S is
the largest team by headcount by year two.

## Language coverage is the requirement

Models must handle Bangla, **Banglish** (Latin-script Bangla), and the major
dialects: Sylheti, Chittagonian, Noakhali, Barishali. Plus the coded language
harassment actually uses, which changes monthly and must be sampled from real
reports rather than assumed.

`trust.moderation_case.detected_lang` records what was detected. A case in an
unsupported dialect routes to a human, never to an auto-action.

## Enforcement rules

- **Every action carries a plain-Bangla reason** (`reason_bn`) and an English
  one. The schema makes both `NOT NULL`, so a reasonless action cannot be
  recorded.
- **Exactly one appeal per case.** Enforced by a unique constraint, not by
  convention.
- **High-reach content gets a human** regardless of model confidence.
  `reach_at_detection` exists so this is a query, not a guess.
- Auto-action is permitted only for high-confidence, low-severity, low-reach
  cases. Everything else is human-reviewed.
- Publish a transparency report. Count actions by category and outcome,
  including overturned appeals.

## The communal and religious protocol

`trust.category` includes `communal_religious` as a distinct value because it
behaves differently from every other category: **an accusation in this category
has escalated to physical violence in Bangladesh.**

It does not enter the normal queue. It goes to a named on-call escalation path
with a senior reviewer, a decision log, and a documented option to remove
content and notify the subject before a mob forms. Speed matters more than
precision here, and the bias is toward removal plus review, not review then
removal.

## Nirapod

Harassment is the single biggest reason women creators in Bangladesh stop
posting. Winning their trust wins the supply side of this market outright, so
Nirapod is a product strategy.

Defaults, all protective, all set in `trust.nirapod_setting`:

| Setting | Default | Why |
|---|---|---|
| `dm_from` | `nobody` | Unsolicited DMs are the primary harassment vector |
| `comment_filter` | `strict` | Bangla/Banglish abuse filtering on by default |
| `allow_duet` | `false` | Duet is used to mock, not only to collaborate |
| `allow_stitch` | `false` | Same |

Plus: one-tap block-report-mute-and-hide-history, and brigading detection
(`trust.harassment_cluster`) that catches many accounts converging on one
target inside a window — because individually-borderline comments from fifty
accounts are an attack even when each one passes review.

## Fraud

- Affiliate: device and address clustering, velocity limits, hold periods,
  clawbacks. Self-purchase rings are the expected attack.
- COD: buyer trust scoring, OTP before dispatch, prepaid delivery fee on first
  orders, blocking repeat refusers.
- Reviews and gifts: no self-gifting (enforced in schema), no seller reviewing
  their own product.

## Age

Feed 13+. LIVE, gifting and selling 18+. Checked at the action, from date of
birth, never from a stored age integer that goes stale —
`identity.may_go_live()` is the only correct way to ask.
