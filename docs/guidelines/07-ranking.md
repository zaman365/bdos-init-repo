# 07 — Ranking guidelines

## What the feed optimises

Predicted **quality of attention**, not volume of it. In order of weight:

1. Completion rate — did the person actually watch it?
2. Positive engagement — likes, comments, shares, follows gained.
3. Recency, decaying over three days.
4. Commerce intent, where a post carries a product.

And one hard negative: report rate.

`packages/ranking/src/index.ts` implements this as `score()`. Those weights are
tunable and expected to change.

## What the feed must never optimise

- **Raw impressions or raw play count.** Rewarding plays rewards clickbait; it
  is why the Sonar Fund pays on qualified watch time rather than views. Ranking
  and payment must agree, or creators optimise against one of them.
- **Session length at any cost.** A metric that goes up when someone cannot
  stop scrolling at 2am is not a success metric.
- **Outrage.** If report rate and watch time both rise, the content loses.
- **Ads inside organic scoring.** Ads run a separate auction with capped
  density and are always labelled. There is no blended score.

## The two structural rules

These are product promises, so they are **not** score weights. A weight can be
outbid; a reservation cannot.

### The audition contract

Every post is owed `guaranteed_impressions`. This was originally a `+1.5` score
bonus, which did not work: an established post scored 4.88 against a new post's
3.29 and simply took the slot. The promise on the landing page — "a real
audition whether you have 50 followers or 500,000" — was false.

It is now a **reserved share of feed slots**: one in every
`AUDITION_SLOT_EVERY` (4) goes to a post still owed its audition, which no
rival's score can take away.

If you change this constant, you are changing a public promise. Say so.

### Author diversity

One creator must not own a session. Spacing is **count-aware**: among authors
other than the previous slot's, prefer the one with the most posts still
queued.

The naive version — "best post whose author is not in the last two slots" —
looks correct and fails: it spends scarce authors early and emits the prolific
one in a run at the tail. With six posts from one author and six from six
others, positions 9–11 were all the same author.

The trade-off is deliberate: author balance outranks score, because "one
creator must not own the feed" is a product rule. Score still orders
everything it can.

When spacing is arithmetically impossible — one author holding most of the
pool — the algorithm degrades to consecutive emission rather than dropping
posts. Showing content beats hiding it.

## Experiments

- Every ranking change ships behind a flag with pre-registered metrics.
- A watch-time win is **rejected** if report rate or D7 retention regresses.
  That rule is the whole difference between a feed people use and a feed people
  resent.
- Ranking tests assert the promise, not the number. "The audition is honoured"
  survives a rewrite; "the boost is 1.5" does not — and did not.

## Search

Bangla script, English and **Banglish** transliteration resolve to the same
results. `searchTerms()` expands a query across scripts; every alias
round-trips in both directions, asserted in tests. People type "kacchi" and
"কাচ্চি" for the same thing and neither is a mistake.
