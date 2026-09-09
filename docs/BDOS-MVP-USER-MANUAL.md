# BDOS MVP User Manual

**Version:** 1.0 · **9 September 2026** · **Branch:** `codex/ecosystem-mvp`

BDOS — Bangladesh On Stage. **দেখো · কিনো · কামাও — Watch · Buy · Earn.**

This manual covers the runnable web MVP: Discover, Cut, Shop, Studio, Affiliate,
Ads, LIVE, and the supporting seller, safety, partner and operations tools.

## 1. Start the application

### Option A: Docker Compose

Install Docker with Compose, then run from the repository root:

```sh
docker compose up --build
```

Open **http://localhost:3000**. Compose creates PostgreSQL, applies migrations,
loads synthetic demo accounts, and starts the app. Data persists in the
`bdos_postgres` and `bdos_media` named volumes. `docker compose down` stops the
services while keeping their data. The Compose configuration binds ports only
to your local machine and is intended for a sandbox.

### Option B: Node and PostgreSQL

Requirements: Node 22.19+ and PostgreSQL 17+. FFmpeg is installed through the
`ffmpeg-static` dependency when `FFMPEG_PATH=bundled`.

```sh
npm ci
cp .env.example .env.local
# Start just the development database if needed:
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Set `DATABASE_URL` in `.env.local` to a **new, dedicated database**. The example
matches the Compose database on port 5433. Migrations are transactional,
checksum-checked, and do not drop databases. The seed command is idempotent and
refuses to run unless `BDOS_SANDBOX=true`.

Open the exact origin in `APP_ORIGIN`. For an IPv4-only local server, set it to
`http://127.0.0.1:3000` and use that address. If another application uses port
3000, start with `npm run dev -- --port 3100` and update `APP_ORIGIN` accordingly.

For a production-style local build:

```sh
npm run build
npm run start
```

**The app is a Node service.** The repository’s existing Cloudflare Pages
configuration still serves `site/`, the marketing site. Pushing this branch does
not turn that static deployment into the new application. The private blueprint
and `docs/` are not served by the Node application.

## 2. Sandbox and accounts

A banner identifies sandbox mode on every signed-in screen. Sandbox payments,
credit, identity decisions, courier tracking and withdrawals do **not** move
real money, verify an actual NID, send a courier, or transfer funds to bKash.
Use synthetic addresses and account numbers.

| Demo role | Phone | Handle | What to try |
|---|---|---|---|
| Viewer | `+8801812345678` | `rifat` | Feed, cart, checkout, orders, gifts |
| Creator | `+8801712345678` | `nusrat` | Cut, samples, earnings, Spark permission |
| Seller | `+8801912345678` | `bogurashop` | Products, stock, fulfilment, campaigns |
| Operations | `+8801512345678` | `operations` | Reviews, ledger, feature switches |
| Partner | `+8801312345678` | `shakib` | Business referrals, creator workflows |
| Minor test account | `+8801612345678` | `tamim` | Confirm LIVE, gifting and selling are blocked |

Select a demo role or enter a phone number, choose **Get code**, then **Sign in**.
The sandbox shows and prefills a fresh six-digit code. Codes expire after five
minutes, permit five verification attempts, and can be used only once. Requests
are limited and must be at least 30 seconds apart.

To register a new account, select **Create an account** and provide a name,
unique handle and date of birth. The minimum feed age is 13; LIVE, gifting,
seller onboarding and withdrawals require 18+. Date of birth is self-declared
in this MVP; production age assurance is a separate integration.

Use **Sign out** to change roles. To run a creator and a viewer at the same time,
use separate browser profiles or an incognito window because sessions are cookie-based.

## 3. Navigation, language and data

The sidebar contains all available surfaces. On a phone, open it with the menu
button. Partner and Operations appear only for authorised roles.

Bangla is the default. The **EN / বাংলা** button changes language and number
formatting and saves the preference to your account. Primary user flows are
bilingual; some specialist operations labels and error messages remain English.
All money is displayed in taka. Internally it is stored as whole paisa.

**Data Saver** is on by default. Videos use a 480-pixel-width transcode, do not
preload under Data Saver, and play when tapped. Turning it off allows metadata
preloading; the MVP still does not force autoplay. This is a responsive web
application, not the native Android APK described in the roadmap.

The bell opens notifications. **Mark read** clears unread indicators. In-app
notifications are limited to ten per account per database day; order and payout
records remain available even when their notification is suppressed.

## 4. Discover and social features

- **For you** ranks published stories using completion quality, engagement,
  recency, a reserved audition share, and author spacing.
- **Following** shows creators you follow. **Pashe** requires a mutual follow.
- Search accepts Bangla and English, with a small explicit Banglish dictionary:
  for example `kacchi` also finds `কাচ্চি`. It is not a general transliteration model.
- The plus/check beside a creator follows or unfollows them. Heart reactions
  toggle once per account. Open comments to write a respectful response.
- Authors can pin and unpin comments on their own posts.
- Share copies a link that reopens the corresponding caption search.
- A product bar opens variant and quantity selection. Adding it to the cart
  records the product click used for affiliate attribution.

Blocked accounts disappear from the feed and cannot contact each other.
Drafts and removed posts cannot be viewed through the public media endpoint.
The initial feed and product catalog are capped for this small MVP; pagination,
large-scale search and offline downloads are future work.

## 5. BDOS Cut

1. Open **BDOS Cut** or **Create a story**.
2. Upload PNG, JPEG, WebP, MP4 or WebM, up to **20 MB**. Uploads are validated by
   file signatures. Videos are transcoded to H.264/AAC MP4 with streaming metadata.
3. Choose Original, Product story, or Day in my life. Add a caption and optional
   on-screen text. The templates change presentation; they do not generate footage.
4. For video, enter start/end seconds to control the playback window. The source
   upload is retained; this is a playback edit, not a downloadable rendered export.
5. Optionally tag an active product.
6. **Save draft** keeps the story private. Select a saved draft to continue.
   **Publish story** places it in the feed and the creator’s content list.

**Remix this story** appears only when the author has enabled Duet or Stitch.
It opens Cut with the parent story and records the lineage. Upload your own
composed clip; automatic split-screen or stitched rendering is not included.

Captions are manual. Automatic Bangla speech recognition, translation, AR,
green-screen compositing and a licensed music catalog are roadmap work.

## 6. Shop and buying

Browse by category or search product names. Every product shows its variants,
price, stock, seller and Bharosha score. In this MVP, Bharosha is the percentage
of terminal orders delivered successfully; a new seller starts at zero. It is
not an independently certified trust rating.

1. Select a variant and quantity; choose **Add to cart**.
2. Review **Your bag**. Delivery is **৳60 per seller**, even when that seller
   supplies multiple products. Checkout creates one order per seller.
3. Enter a complete delivery address and district. Choose COD, bKash, Nagad or
   card. Digital methods are sandbox simulations.
4. Optionally enter a voucher. The demo seller has `STAGE100`: ৳100 off a goods
   subtotal of at least ৳1,000, expiring 30 days after seeding.
5. Place the order. Inventory is reserved atomically; simultaneous orders cannot
   buy the same final unit.
6. In **My orders**, choose **Confirm delivery details**. This is confirmation
   by the signed-in buyer; a separate dispatch OTP integration is not included.

COD prepays the delivery fee in the sandbox. The remaining COD cash is recorded
at confirmed delivery. Digital payment holds the full amount in escrow.

You may cancel before dispatch. After shipment, choose **Confirm received** only
when the simulated delivery is complete. Delivery allocates the escrow to the
seller, platform, courier and illustrative tax accounts.

### Returns

Within seven days of delivery, choose **Request return** and explain why.
The seller approves the return and refund after inspection. Approval returns the
full order amount in the sandbox, restores stock once, reverses the seller/fee
allocation, and claws back any held affiliate commission. Repeating a completed
state transition is rejected.

The MVP supports whole-order returns. Partial returns and dispute adjudication
are not implemented. Return requests remain reserved until resolved.

## 7. Seller Center

A new seller applies with a business name and a registration reference. Operations
must approve the application before products or campaigns can be created.

- **Catalog:** list or edit a product with Bangla and English titles, category,
  description, default variant, price, stock, and cover artwork. Add more variants
  with **+ Variant**. Pausing a listing removes it from the public catalog.
- **Orders:** dispatch only after buyer confirmation. Choose a courier to create
  a `SANDBOX-…` tracking reference. The adapter simulates the courier; it does not
  contact Pathao, Steadfast or the other displayed services.
- **Returns:** approve a requested return to issue the sandbox refund.
- **Failed delivery (RTO):** restores stock, refunds the prepaid amount and books
  the courier attempt as an expense.
- **Promotions:** create a voucher or a brand brief. A voucher lasts 30 days;
  a brief accepts creator pitches, and you can select an applicant.
- Seller funds are excluded from withdrawal while their order’s seven-day return
  window is open or a return is pending. Use Profile & Nirapod to withdraw cleared funds.

Fulfilment warehouses, physical courier operations, statutory invoicing and
real payment reconciliation are outside the MVP.

## 8. Affiliate

**Discover products** displays eligible commission rates and potential gross
commission. Add products to your showcase, then create a product-tagged story.
Showcase selection alone does not earn commission; a recorded click and delivered
purchase are required.

Sellers can create **open**, **targeted**, or **shop-wide** plans. Targeted plans
require a selected creator. Rates cannot exceed the category marketplace fee.
Where several plans apply, the highest eligible rate is selected and snapshotted
onto the order. Affiliate commission is paid from the platform’s fee.

**Samples:** request a sample with a pitch. The seller approves or declines it,
then records shipment tracking. The creator marks receipt and later content
posted. Marking content posted requires a published post tagging that product.
One request per creator/product is allowed in this MVP.

**Commission ledger:** delivery creates an accrual with gross, withholding, net,
state and hold expiry. A qualifying click must be within seven days. Self-purchases
and seller-self attribution are excluded. Device/address clustering is not implemented.

Operations can **Clear eligible commissions**, or run `npm run maintenance`.
Only expired holds on delivered/completed orders clear. A withdrawal also checks
eligible holds. No UI control bypasses the seven-day window.

### Worked example

For the demo Jamdani, ৳2,400 goods + ৳60 delivery:

| Allocation | Amount |
|---|---:|
| Category fee (8% of goods) | ৳192.00 |
| Illustrative VAT (5% of fee) | ৳9.60 |
| Seller net | ৳2,198.40 |
| Courier | ৳60.00 |
| Affiliate gross (3%, from platform fee) | ৳72.00 |
| Illustrative affiliate withholding (10%) | ৳7.20 |
| Creator net after hold | ৳64.80 |

These tax figures are inherited **sandbox assumptions**, not current tax advice.

## 9. Studio, gifts and payouts

Studio shows your posts, unique recorded plays, completion rate, available
creator earnings and held commission. Demo fixtures begin with zero engagement;
metrics grow through use. Retention bars show completion rates, not full time-series curves.

The Academy contains four lessons. Marking a lesson complete saves progress.
The creator marketplace shows brand briefs and allows a creator to submit a pitch.
Recurring subscriptions, tips and paid Sonar Fund rewards remain roadmap items.

Before withdrawing:

1. Save a **sandbox payout destination** (bKash, Nagad, Rocket, Upay or BEFTN).
2. If necessary, request a sandbox identity review and have Operations approve it.
3. Choose a source and gross amount. Held money cannot be withdrawn.
4. Review the payout result and receipt in the history.

Gift/Spark withdrawals apply illustrative 10% withholding. Affiliate earnings
are already net of withholding. For example, a ৳50 Rickshaw gift gives the creator
৳30 before withholding; withdrawing that amount records ৳27 net and ৳3 tax.

**Simulate provider failure** exercises a failed payout. The balance stays unchanged
and a new request can retry. Simultaneous withdrawal requests cannot spend the
same balance twice. Every transfer reference is prefixed `sandbox-`.

## 10. LIVE

Adults can create a room with a title and optional product anchor. Click
**Start camera** and grant camera/microphone permission in your own browser.
A viewer joins from another browser account. The host sends audio/video through
WebRTC; chat and signalling are persisted in PostgreSQL and polled.

This is a **small-room, same-network MVP** with no configured STUN/TURN service.
It does not provide RTMP ingest, a global relay, LL-HLS delivery, cohost or PK.
HTTPS is required for browser camera access outside localhost.

Viewers add sandbox credit and send a gift. The catalog ranges from Shapla (৳10)
to Padma Setu (৳20,000). The creator gets 60% and the platform 40%, before
illustrative withholding. Self-gifting and gifting to an ended room are rejected.

**Stop camera** stops the media tracks. **End LIVE** closes the room. Leaving the
screen stops local media but does not end the room; a host can reopen it and
restart the camera, or end it explicitly. Messages and gifts do not restart the video.

## 11. Nirapod and operations

New accounts have DMs off, strict comment filtering, and Duet/Stitch disabled.
Change these in **Profile & Nirapod**. The MVP’s comment/chat filter uses a small
explicit phrase list; it is not a trained multilingual safety classifier.

Use the flag on a post to report it. **Also block this creator** hides their
content and prevents interaction. Unblock in your profile. A report opens a
human review case. Critical categories are labelled for priority review; a real
24/7 escalation organisation is not supplied by the software.

Operations can remove or dismiss a case with both Bangla and English reasons.
The subject sees the reason in their profile and can appeal once. Operations
upholds or overturns the appeal. Other active removals on the same post prevent
an unrelated appeal from restoring it.

Operations also reviews sellers, synthetic identity records and campaigns,
updates partner referrals, inspects append-only journals/audit history, and
pauses modules using server-enforced switches.

A zero ledger drift means the internal journal balances. It does **not** verify
bank cash, courier cash or a payment provider’s settlement statement.

## 12. Ads

1. A creator opens Ads Manager and grants Spark permission for a published post
   to a seller. Revoking permission pauses affected campaigns.
2. The seller creates a campaign with an authorised post, own product, objective,
   total budget, daily budget and per-impression bid.
3. Operations reviews it. Approved campaigns can be paused and resumed.
4. The advertiser funds sandbox credit. Eligible placements are served separately
   from organic ranking, at most once on a feed page with four or more stories.
5. The card is explicitly labelled **Sponsored · Spark**. Impressions are recorded
   only after it enters view. Signed placement tokens, daily deduplication and
   transaction locks protect billing.

The MVP charges the entered amount **per impression**. The inherited schema calls
this `cpm`; do not interpret the UI bid as a per-thousand amount. Creator Spark
revenue share is 10% of charged spend, rounded down to whole paisa.

Clicks require a recorded impression. Delivered purchases of the advertised
product within seven days of a click generate a conversion event. Counts are
unique per campaign/user/day and are gross delivery conversions, not refund-net ROI.
Off-site pixel/Events API, automated bidding, Sales Max and production ad auctions
are not implemented.

## 13. Partner Network

Partner accounts submit a business name, district and phone as an onboarding lead.
Operations marks it contacted, onboarded or rejected. This tracks referrals; it
does not automatically create a seller or pay agency revenue shares.

## 14. Maintenance, tests and troubleshooting

```sh
npm run typecheck
npm test                  # money, ledger and ranking
npm run test:integration   # disposable DB: financial, permission and media tests
npm run build
npm run test:e2e           # browser suite; install Chromium first
npm run maintenance       # clear eligible holds, prune expired transient records
```

Install the browser test runtime with `npx playwright install chromium`.
Integration tests create and drop a uniquely named database; the test database
role needs `CREATEDB`. Browser tests create synthetic accounts in a seeded sandbox.
Never point tests at a real customer database.

| Symptom | What to check |
|---|---|
| Wrong app or rejected origin | Use the exact `APP_ORIGIN`; try IPv4 `127.0.0.1` if localhost reaches another service |
| Cannot load data | Check `DATABASE_URL`, PostgreSQL health, and `npm run db:migrate` |
| Code expired / throttled | Request a new code after the displayed cooldown; codes are single-use |
| Upload processing fails | `FFMPEG_PATH=bundled`, dependency installation, valid format, 20 MB limit |
| Empty Following/Pashe | Follow creators; Pashe requires mutual following |
| Cannot dispatch | The buyer must confirm delivery details first |
| Cannot withdraw | Check KYC, default payout destination, source balance, and return-window holds |
| No ads served | Check approval, consent, credit, caps, published source post, and at least four feed posts |
| LIVE has no video | Host must start camera; allow permission; use separate accounts on the same network |
| Feature paused | Operations → Controls → enable the corresponding switch |
| Duplicate request error | Refresh; a record may already exist or the transition was already completed |

Back up PostgreSQL **and** the media directory together. Keep financial journals,
idempotency receipts and audit history. Maintenance removes expired sessions,
old OTP/rate-limit rows and old signalling records, not money history.

Outside sandbox, authentication supports a configurable HTTPS SMS adapter
(`SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`, and a 32+ character `AUTH_SECRET`). The
adapter receives JSON `{to, message}` with bearer authentication and must return
2xx on acceptance. Money and courier actions remain unavailable until actual
provider adapters and external reconciliation are implemented and verified.
