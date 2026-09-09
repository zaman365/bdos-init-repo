# 06 — Data and privacy guidelines

Assume Bangladesh will require in-country storage of personal data and design
for it now. Retrofitting residency after launch means re-architecting the
identity layer under load.

## What we collect, and what we refuse to

Collected because a workflow genuinely needs it: phone number (identity and
payout), date of birth (age gating), delivery address (fulfilment), payout
account reference, watch and engagement signals (ranking).

**Refused**, regardless of how useful it would be: contact-list upload, precise
background location, cross-app tracking identifiers, biometric data. Each of
these has a plausible growth argument and none survives the question "would we
be comfortable explaining this to the person it describes?"

## KYC and identity documents

NID images, TIN and BIN documents never enter the main database.
`identity.kyc_record` stores a **vault reference and a verdict** — nothing
else. The vault is in-country, access-audited, and readable by a named set of
roles rather than by the application.

This is why `kyc_record` has a `vault_ref` column and no image column: the
schema makes the wrong thing impossible rather than discouraged.

## PII in logs

Never log a phone number, an address, a payout reference, or an OTP. Log the
user id. `lib/http.ts` logs `error.message` only — a stack trace containing a
query with bound parameters is a PII leak into whatever aggregates logs.

## Retention

| Data | Keep | Why |
|---|---|---|
| Journal entries | Indefinitely | Financial record; append-only by law and design |
| Order and shipment records | 7 years | Tax and dispute window |
| OTP codes | 5 minutes | Longer is only useful to an attacker |
| Session tokens | 7 days | Rotate on privilege change |
| Rate-limit counters | Until reset | Operational only |
| Nonfinancial watch/signal/like/preference receipts | 30 days | Retried transient actions |
| Money and unclassified legacy command receipts | Retained | Prevent historical money commands being replayed |
| Watch events | 90 days raw, then aggregate | Ranking needs recency, not history |
| Moderation cases | 2 years | Appeals and pattern detection |

`npm run maintenance` removes expired OTPs, sessions, rate counters, old signalling
and the explicitly classified nonfinancial receipts. It reports row counts and
writes an audit event. Run it on an operations schedule; a branch push does not
install a scheduler. Other retention rows above are production policy targets,
not implemented automatic deletion jobs.

## Secrets

- OTP codes are **HMAC'd with a server-side secret**, not bare SHA-256. A
  six-digit code has a 10⁶ keyspace: an unsalted hash is recoverable instantly
  from a database read. (Audit M2 — resolved.)
- Session tokens are 32 random bytes; SHA-256 storage is adequate there because
  the input is high-entropy.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and **`Secure` by default** —
  local HTTP requires an explicit opt-out, not the reverse. (Audit M3 — resolved.)
- No secret is ever committed. `.env.local` is gitignored; `.env.example`
  carries names and shapes only.

## Access to user data

- `sessionInfo()` supplies only existing follow relationships and conversations,
  filtering blocked/inactive users. It does not supply arbitrary account lists.
  The public feed and seller catalog still identify their publishers/businesses.
- Search hiding is enforced in the feed query. Media, DMs and LIVE also check
  account state, not just knowledge of an object ID.
- Media is private by default and served through an authorising route
  (`lib/media.ts` checks ownership, blocks, and published state) rather than a
  guessable public path.
- Internal access to production data is role-scoped and logged in `app.audit`,
  which is append-only by trigger.

## Cross-border

Creator payouts settle in BDT, domestically. Coins are prepaid digital goods,
not a transferable payment instrument — that distinction is load-bearing under
Bangladesh Bank rules and must not be softened for a product convenience.
