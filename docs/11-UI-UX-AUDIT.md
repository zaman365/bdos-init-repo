# BDOS MVP — UI/UX Audit and Improvement Report

**Date:** 9 September 2026  
**Branch:** `codex/ecosystem-mvp`  
**Audited commit:** `e6333a62e8336a205a24c7bcd359e31f6eb2057d`  
**Status:** Audit complete. **All five P1 findings are fixed and verified in a
running instance** (see "P1 resolution" at the end). The eleven P2 findings
remain open.

## Assessment

The MVP has a recognizable visual identity and its modules share a useful shell,
but several interactions undermine the intended smooth creator–viewer–seller
journey. The most urgent defects are misplaced moderation content in Ads,
missing evidence in Operations case cards, focus entering the hidden mobile
navigation, stale Profile preferences, and loss of unsaved editor work.

This report identifies **16 findings: 5 P1 and 11 P2**. No P0 issue was established
within this audit. Passing functional tests and containing page width do not
establish that the interface is accessible, consistent, or ready for user trials.

**Priority definitions:** P1 means fix before a broader MVP usability trial because
the issue loses work, misrepresents state, obstructs navigation, or weakens a core
review workflow. P2 means a material clarity, accessibility, or consistency issue
to address in the next improvement cycle. These are UX priorities, not security
severity ratings.

## Scope and method

The audit compared the current Next.js application with the repository's
[product guidelines](guidelines/02-product.md),
[design guidelines](guidelines/03-design.md),
[brand system](04-brand-system.md), and
[MVP user manual](BDOS-MVP-USER-MANUAL.md).

- Inspected shared components, styles, navigation, forms, and the corresponding
  data/command handlers where they determine visible behavior.
- Used headless Chromium against the local sandbox at `127.0.0.1:3000`, with
  **1280 × 800** desktop and **390 × 844** mobile-sized viewports.
- Examined seeded creator, buyer, seller, operations, partner, and minor accounts.
  UI language was Bangla or English according to each account; explicitly checked
  switching language while Profile stayed mounted.
- Captured screenshots, inspected accessible roles and names, exercised keyboard
  navigation, measured selected control rectangles, and calculated contrast from
  computed foreground colors and opaque background colors.
- Temporarily changed the creator's language and a buyer's cart quantity, then
  restored those values. No order, payout, promotion permission, or moderation
  decision was submitted. Browser visits and temporary actions can leave normal
  local analytics/authentication/audit records.

**Evidence labels:** **Runtime** means reproduced in the browser; **Measured**
means an observed DOM/style value; **Source** means established by tracing the
current implementation, without claiming the corresponding populated runtime
state was exercised. Recommendations and acceptance criteria describe future work.

This is a focused heuristic and browser audit, not accessibility certification or
user research. It does not cover physical Android/iOS devices, screen-reader
speech output, every validation/network-failure state, live camera sessions,
production payments, or performance under poor connectivity. The legacy
`site/` marketing pages received a source spot-check, not a complete browser audit;
the findings and counts below concern the MVP application. All source line links
refer to the audited commit and may move after implementation.

### Coverage by surface

| Surface                   | Evidence reviewed                                                          | Main findings        |
| ------------------------- | -------------------------------------------------------------------------- | -------------------- |
| Shared shell / navigation | Desktop and mobile; keyboard focus; language switch; CSS                   | UX-03, 08–12, 14, 16 |
| Discover / search         | Desktop and mobile feed; tab keyboard behavior; product/ad handlers        | UX-10–13             |
| BDOS Cut                  | Desktop and mobile editor; unsaved navigation; draft save source           | UX-05, 08, 11        |
| Shop / cart / checkout    | Desktop and mobile; repeated add; checkout dialog without placing an order | UX-06–09, 11, 14     |
| My orders                 | Creator empty state; populated seller order cards; action source           | UX-07, 08            |
| LIVE                      | Desktop empty room listing; room controls and purchase source              | UX-08, 11, 15        |
| Creator Studio / payouts  | Desktop populated content and empty balances; payout source                | UX-07, 08, 15        |
| Affiliate                 | Desktop product discovery; samples and ledger source                       | UX-08, 10, 15        |
| Seller Center             | All three desktop tabs; mobile catalog and responsive containment          | UX-08, 10, 11        |
| Ads / Spark               | Populated creator permissions; empty-post account; dialogs                 | UX-01, 08, 09, 15    |
| Inbox                     | Desktop empty state; recipient and message source                          | UX-08, 15, 16        |
| Profile & Nirapod         | Desktop preferences, language mismatch, safety/appeal source               | UX-04, 07, 08        |
| Partner Network           | Desktop and mobile empty lead table; lead form source                      | UX-08, 15            |
| Operations                | All five desktop tabs; mobile containment; case renderer/data query        | UX-02, 08, 10        |

### What is already working well

- Green primary actions, the Matra heading accent, and tab indicators above labels
  give the application a consistent identity worth retaining.
- Major visited desktop surfaces rendered without uncaught page errors in the
  creator sweep. No document-level horizontal overflow was found in that sweep
  or in the sampled mobile surfaces. Wide seller tables use an inner scroll area.
- The shared money component localizes currency values; the problem is inconsistent
  use outside it. Switching language also updates the document's `lang` attribute.
- Focus-visible styles, a skip link, native modal dialogs, explicit form labels,
  reduced-motion CSS, loading states, and modal error alerts already provide a
  foundation for the accessibility improvements below.
- Sandbox messaging is visible. Checkout identifies simulated payments, and payout
  panels explicitly say that real money is not sent.

## Prioritized findings

| ID    | Priority | Finding                                                         | Evidence           | Suggested owner                    |
| ----- | -------- | --------------------------------------------------------------- | ------------------ | ---------------------------------- |
| UX-01 | P1       | Spark permissions render moderation metadata and `Invalid Date` | Runtime + Source   | Ads UI                             |
| UX-02 | P1       | Operations case cards omit report evidence and case age         | Source             | Trust & Safety UI                  |
| UX-03 | P1       | Closed mobile navigation remains keyboard-focusable             | Runtime + Measured | Shared navigation                  |
| UX-04 | P1       | Header language and Profile field disagree                      | Runtime + Source   | Profile / preferences              |
| UX-05 | P1       | Leaving Cut silently discards unsaved work                      | Runtime + Source   | Creator tools                      |
| UX-06 | P2       | “Add to cart” replaces the existing quantity                    | Runtime + Source   | Commerce                           |
| UX-07 | P2       | Money confirmations omit a complete transaction review          | Runtime + Source   | Commerce / payouts                 |
| UX-08 | P2       | Bangla/English, money, dates, and statuses are inconsistent     | Runtime + Source   | Content design / shared formatting |
| UX-09 | P2       | Shared dialogs lack accessible names and help associations      | Runtime + Source   | Shared forms                       |
| UX-10 | P2       | Navigation and tabs expose inconsistent selected states         | Runtime + Source   | Shared navigation                  |
| UX-11 | P2       | Small touch targets and text weaken mobile usability            | Measured + Source  | Design system                      |
| UX-12 | P2       | Several small-text colors miss the documented contrast target   | Measured           | Design system                      |
| UX-13 | P2       | Product and search entry points lose their promised context     | Source             | Discovery / commerce               |
| UX-14 | P2       | Mobile hides Data Saver and puts the bag after the catalog      | Runtime + Source   | Mobile navigation / commerce       |
| UX-15 | P2       | Empty and ineligible states still offer unusable actions        | Runtime + Source   | Module owners / onboarding         |
| UX-16 | P2       | Notifications lack item state, time, and a next action          | Source             | Notifications                      |

### UX-01 — Spark permissions show the wrong domain's content

**Observed:** Creator Ads cards display `report(s) · opened Invalid Date` beside
“Revoke permission.” The consent payload has no `opened_at` or `report_count`.
The missing date is rendered directly, and the action runs into the metadata line.
This makes a permission look like a moderation incident and damages confidence in
what is being granted or revoked.

**Evidence:** [Ads screenshot](assets/ui-ux-audit/ads-desktop.png);
[consent renderer, workspace.tsx:921](../app/components/workspace.tsx#L921);
[consent query, read.ts:264](../lib/read.ts#L264).

**Improve:** Give consent cards an explicit, typed data contract. Show the seller,
story, actual permission status and any supported consent date. Put revocation on
its own action row. Remove moderation-only fields from this component.

**Acceptance:** A seeded consent renders no `Invalid Date`, empty report count,
or moderation terminology. Missing optional dates have an intentional fallback.
Grant/revoke state and its campaign consequence are clear in both languages.

### UX-02 — Reviewers cannot see report evidence in case cards

**Established by source:** The Operations query supplies `report_count`, `evidence`,
`opened_at`, and `overdue`, but the case renderer shows category, subject, severity,
state, caption, and an optional appeal statement. It does not render the supplied
report notes, count, or case age. The queue-level overdue count cannot identify
which card needs urgent review. The local runtime queue was empty, so a populated
case was not exercised in this audit.

**Evidence:** [case query, read.ts:289](../lib/read.ts#L289);
[case renderer, workspace.tsx:1323](../app/components/workspace.tsx#L1323).
This contradicts the A6 statement that evidence is visible to Operations in
[the previous implementation record](10-BRANCH-AUDIT-IMPROVEMENT-PLAN.md).

**Improve:** Render report notes, report count, opened time/age, and a per-case
overdue marker beside the decision action. Distinguish report evidence from an
appeal statement. Provide a safe path to inspect the associated story.

**Acceptance:** A browser fixture with multiple reports and an overdue critical
case exposes the notes and urgency before “Review case.” A case without notes has
a clear empty state. Verify the UI before updating the prior completion claim.

### UX-03 — Keyboard focus disappears into the closed mobile drawer

**Reproduce:** At 390px width, load Discover with the menu closed and press Tab
past “Skip to content.” Focus enters “BDOS home,” “Create a story,” and the sidebar
items while their rectangles are offscreen. The home button was at **x = −227px**.
The drawer is translated out of view but remains in the focus order. The menu
toggle also lacks an expanded state and controlled-element relationship.

**Evidence:** [Shell.tsx:233](../app/components/Shell.tsx#L233),
[menu toggle, Shell.tsx:307](../app/components/Shell.tsx#L307),
[mobile drawer CSS, globals.css:2303](../app/globals.css#L2303);
[recorded measurements](assets/ui-ux-audit/measurements.json).

**Improve:** Make the closed drawer inert/hidden for interaction at the mobile
breakpoint. When open, manage focus within the modal drawer, support Escape, and
return focus to the toggle. Expose `aria-expanded` and `aria-controls`.

**Acceptance:** Closed-menu tab order contains only visible controls. Opening,
traversing, closing, and following a destination never leaves focus offscreen.
Verify desktop navigation still works after resizing across the breakpoint.

### UX-04 — Saving Profile can restore a stale language preference

**Reproduce:** Open Profile in Bangla, then select EN in the header. The heading
becomes “Your space. Your rules.” but the Profile language select still says
“বাংলা.” The field uses `defaultValue`, while the header refreshes account data
without remounting Profile. The submit handler reads the stale select value;
saving another profile edit can therefore write the old language back. The stale
display was reproduced; that subsequent save was not submitted.

**Evidence:** [mismatch screenshot](assets/ui-ux-audit/profile-language-mismatch.png);
[Profile submit, workspace.tsx:975](../app/components/workspace.tsx#L975);
[language field, workspace.tsx:1016](../app/components/workspace.tsx#L1016);
[header preference, Shell.tsx:363](../app/components/Shell.tsx#L363).

**Improve:** Use a shared preference source and an explicit profile draft state.
Synchronize external preference updates without overwriting unsaved name/bio edits.
Review the duplicated Data Saver checkbox for the same class of stale-state risk.

**Acceptance:** Switching header language updates the field. Saving a name change
does not reverse the language. Unsaved name/bio edits survive the synchronization.
Repeat the check for Data Saver and a failed preference request.

### UX-05 — Cut loses unsaved text when users navigate away

**Reproduce:** Enter a caption in Cut, navigate to Discover using the mobile menu,
then return to Cut. The caption is empty and no discard confirmation appears.
Cut stores the draft inputs in component state; only the explicit “Save draft”
action persists them. The same component also holds captions, media selection,
tagged product, template, and trim settings.

**Evidence:** [editor state, content.tsx:513](../app/components/content.tsx#L513);
[save behavior, content.tsx:534](../app/components/content.tsx#L534);
[save/publish controls, content.tsx:701](../app/components/content.tsx#L701).

**Improve:** Track unsaved changes and offer Save draft / Discard / Stay when
leaving. Alternatively provide a private, clearly indicated autosave with an
explicit retention policy. Show saving, saved, and failed-to-save states.

**Acceptance:** Internal navigation and browser navigation cannot silently lose
edited text. Saved drafts reopen with all supported fields, and saving a private
draft never publishes it. Handle sign-out and account changes without exposing
one account's draft to another.

### UX-06 — Adding again reduces the bag quantity

**Reproduce:** Add two units of Everyday Jamdani. Open its “Add to cart” dialog
again and submit the default quantity of one. The bag changes from **2 to 1**,
rather than increasing to three. The command intentionally sets an absolute
quantity, while the UI presents an additive action. The bag itself only offers
removal, so the quantity-editing path is also hard to discover.

**Evidence:** [product dialog, shop.tsx:125](../app/components/shop.tsx#L125);
[cart row, shop.tsx:196](../app/components/shop.tsx#L196);
[quantity upsert, commerce.ts:221](../lib/commerce.ts#L221);
[recorded results](assets/ui-ux-audit/measurements.json).

**Improve:** Define separate “add quantity” and “set quantity” interactions, with
explicit labels and quantity controls in the bag. Keep stock limits and retry
idempotency intact; an automatic retry must not add the same units twice.

**Acceptance:** Adding two then one gives three; explicitly editing to one gives
one. Quantities and totals agree across Shop, tagged stories, LIVE, and the bag.
Stock exhaustion is explained before or beside the relevant control.

### UX-07 — Final money dialogs do not summarize the transaction

**Observed / source:** The checkout dialog asks for address, payment method and
voucher but contains no item summary, payable amount, discount preview, or numeric
“due now / due on delivery” breakdown. The cart totals are outside the modal.
The payout dialog similarly collects source and gross amount without a dynamic
deduction/net preview or destination summary in the confirmation itself.

**Evidence:** [checkout screenshot](assets/ui-ux-audit/checkout-dialog.png),
[mobile checkout](assets/ui-ux-audit/checkout-mobile.png);
[checkout fields, shop.tsx:235](../app/components/shop.tsx#L235);
[payout fields, workspace.tsx:273](../app/components/workspace.tsx#L273).

**Improve:** Add a server-backed review summary before submission: items, seller
delivery charges, applied discount, total, payment split, and delivery destination.
For withdrawals show gross, applicable sandbox deduction, net, source balance,
and masked destination. Keep simulation messaging clear and separate from amounts.

**Acceptance:** Changing a voucher or payment/source choice updates the displayed
breakdown before commitment. COD identifies both amounts due. The final receipt
matches the accepted quote; a changed quote requires renewed review. This finding
concerns presentation, not a claim that the current ledger arithmetic is wrong.

### UX-08 — Localization stops partway through important workflows

**Observed:** Bangla pages retain English action labels and help: Spark permission
dialogs, Ads statistics, privacy options, Academy lesson bodies, and partner and
operations controls. English Profile still includes “Nobody · বন্ধ.” Raw statuses
such as `published`, `open`, and `cancelled` appear alongside localized copy.
Some of this is interface text, rather than user-authored content that should stay
in its original language.

Prices also diverge: the shared `Money` component renders localized currency,
while SKU options construct strings such as `৳2400` directly. Dates use bare
`toLocaleString()`, which follows the browser instead of the app language and does
not explain the relevant time zone.

**Evidence:** [Spark dialog](assets/ui-ux-audit/spark-dialog.png);
[privacy options, workspace.tsx:1023](../app/components/workspace.tsx#L1023);
[Academy bodies, workspace.tsx:118](../app/components/workspace.tsx#L118);
[variant prices, shop.tsx:143](../app/components/shop.tsx#L143);
[order state/date, shop.tsx:348](../app/components/shop.tsx#L348);
[empty-state fallback, ui.tsx:63](../app/components/ui.tsx#L63).

**Improve:** Introduce a shared UI message catalog, status-label mapping, money
formatter, and date formatter. Translate action labels, explanations, errors,
accessibility names, and empty states. Define a time-zone policy for deadlines.
Preserve user content and established provider/brand names.

**Acceptance:** Complete representative create, buy, earn, safety, seller, and
partner journeys in each language without untranslated system instructions.
Amounts use one currency format per locale; deadline dates identify their zone.
Long Bangla labels remain readable at 390px and larger text settings.

### UX-09 — Modal dialogs are unnamed in the accessibility tree

**Observed:** The Spark modal's accessibility snapshot starts with an unnamed
`dialog`. It has a visible heading but neither `aria-labelledby` nor `aria-label`.
The shared form renderer also places help text beside fields without explicit
description associations. This affects the common dialog pattern across modules.

**Evidence:** [FormDialog, ui.tsx:124](../app/components/ui.tsx#L124),
[help text, ui.tsx:211](../app/components/ui.tsx#L211);
[recorded dialog snapshot](assets/ui-ux-audit/measurements.json).

**Improve:** Associate the dialog with its heading and applicable description.
Give fields stable IDs and connect help/error text. Preserve the native modal
behavior while making initial focus and focus restoration intentional. Extend
dirty-form protection to dialogs that contain substantial user input.

**Acceptance:** Role-based lookup can find each dialog by its visible title.
Keyboard users can reach all fields and actions, errors identify the relevant
input, and closing returns focus to the trigger. Verify speech output separately
with a real screen reader.

### UX-10 — Tabs and navigation use inconsistent interaction semantics

**Observed:** Discover uses `tablist`/`tab` and `aria-selected`, but all three tabs
have `tabIndex=0`, no panel relationship, and ArrowRight leaves focus on “For you.”
Seller, Affiliate, and Operations use ordinary buttons styled as tabs, without a
programmatic selected state. Main navigation also conveys the current destination
through CSS alone.

**Evidence:** [Discover tabs, content.tsx:54](../app/components/content.tsx#L54);
[Seller tabs, shop.tsx:612](../app/components/shop.tsx#L612);
[Operations tabs, workspace.tsx:1310](../app/components/workspace.tsx#L1310);
[main navigation, Shell.tsx:252](../app/components/Shell.tsx#L252).

**Improve:** Reuse a tab component with consistent keyboard behavior, selected
state, and panel relationships. Expose current navigation state, preferably using
links for navigable destinations. Move focus intentionally after a mobile route
change so it does not remain in a now-hidden menu.

**Acceptance:** Tabs work with the same arrows, Home/End, and activation model in
every module. Assistive technology can identify the selected tab and current page.
Reload and browser back retain the existing working route behavior.

### UX-11 — Mobile targets and typography fall below the intended baseline

**Measured at 390px:** The language switch is **39 × 44px**. The Bangla “পাশে” tab
is approximately **26 × 47px**. The global search container is **33px high**, with
an input rectangle approximately **16px high**. These fall below the repo's 44px
touch-target rule in at least one dimension. The measurement excludes the Next.js
development toolbar, which is not a product control.

The mobile rules also shrink product descriptions to **9px**, product headings to
13px, and some auxiliary labels to 8px. Two narrow catalog columns amplify the
reading burden for the small-screen audience described in the design guidelines.

**Evidence:** [mobile feed](assets/ui-ux-audit/feed-mobile.png),
[mobile shop](assets/ui-ux-audit/shop-mobile.png);
[mobile search, globals.css:2336](../app/globals.css#L2336),
[small-screen typography, globals.css:2728](../app/globals.css#L2728),
[target overrides, globals.css:2817](../app/globals.css#L2817).

**Improve:** Establish a reusable minimum target size, including compact/text
actions, and increase useful reading sizes. Rebalance catalog density where two
columns force important text too small. Keep secondary details available without
requiring tiny text.

**Acceptance:** Interactive hit areas meet the documented 44 × 44px rule without
overlap. Review 320px, 390px, and 760px widths plus 200% text enlargement. Product
names, quantities, form instructions, and prices remain readable and actionable.

### UX-12 — Small text misses the repo's contrast target

The design guideline requires at least **4.5:1 for body text**. These selected
desktop computed-color pairs fall short; none is large text:

| Element                                  | Foreground / background | Font size | Contrast |
| ---------------------------------------- | ----------------------- | --------: | -------: |
| Sidebar section label `.nav-label`       | `#65776C` / `#0C110E`   |       8px |   4.00:1 |
| Feed note `.tab-note`                    | `#4E6957` / `#0C110E`   |       8px |   3.16:1 |
| Footer `.footer`                         | `#677D6D` / `#0C110E`   |      10px |   4.29:1 |
| Sandbox secondary label `.sandbox-right` | `#668672` / `#122319`   |       8px |   4.08:1 |

**Evidence:** [computed measurements](assets/ui-ux-audit/measurements.json);
[nav label CSS, globals.css:432](../app/globals.css#L432),
[sandbox text, globals.css:614](../app/globals.css#L614),
[footer, globals.css:652](../app/globals.css#L652),
[feed note, globals.css:691](../app/globals.css#L691).

**Improve:** Define tested primary, secondary, and muted text tokens for actual
surfaces and replace low-contrast one-off colors. Treat small helper text as
readable content. Review white text on bright LIVE badges separately; the table
above is a sample, not a complete contrast inventory.

**Acceptance:** All retained informational text meets the relevant documented
contrast target, including hover/focus and overlay states. Recalculate using actual
composited backgrounds where transparency, artwork, or gradients are involved.

### UX-13 — Discovery entry points lose product and search context

**Established by source:** The feed's specific product tiles and a sponsored
“Explore product” action call `go("shop")` without a product identifier. Users
must locate the item again. In contrast, ordinary tagged-story and LIVE product
anchors open a product-specific purchase dialog. The global search placeholder
promises stories and people, while submission navigates to the story feed; there
is no dedicated people-results view or scope explanation.

**Evidence:** [feed product tiles, content.tsx:139](../app/components/content.tsx#L139),
[ad action, content.tsx:193](../app/components/content.tsx#L193),
[tagged purchase, content.tsx:334](../app/components/content.tsx#L334),
[global search, Shell.tsx:315](../app/components/Shell.tsx#L315).

**Improve:** Preserve product identity through a product route or shared detail
panel. Preserve attribution and return context. Make search scope explicit; either
provide distinguishable people results or accurately describe story search.

**Acceptance:** Every product-specific entry opens the intended item without a
second search. Back returns to the originating context. A query's result type is
clear, including when no matching story or person is available.

### UX-14 — Mobile prioritization hides two important controls

**Observed:** Desktop has a sticky cart beside products. At mobile width the bag
follows the entire catalog, without a persistent bag-count shortcut. With five
local products, its top was about **1,862px from the document top** in the initial
Bangla capture, below the first two viewports. This distance grows with content.
The Data Saver header button is also hidden at the mobile breakpoint, while
language, notifications, and sign-out retain header space. Data Saver remains
available through Profile, but loses its top-level visibility on phones.

**Evidence:** [mobile shop](assets/ui-ux-audit/shop-mobile.png);
[Shop layout, shop.tsx:45](../app/components/shop.tsx#L45),
[Data Saver mobile rule, globals.css:2349](../app/globals.css#L2349),
[header actions, Shell.tsx:344](../app/components/Shell.tsx#L344).

**Improve:** Provide a visible bag count and jump/open action after adding an
item. Keep Data Saver status and toggle easy to reach in the mobile header or
first-level menu. Resolve space through an intentional action hierarchy.

**Acceptance:** After adding from anywhere in the catalog, users can find their
bag in one action without scrolling through all products. Mobile users can see
and change Data Saver from top-level navigation, with accessible state labels.

### UX-15 — Empty and ineligible states lead into dead-end forms

**Observed:** An account with no published posts can open “Grant promotion
permission.” The required post select has **zero options**, while “Grant
permission” remains enabled. The form cannot be completed. Similar source patterns
exist in the message recipient picker when there are no eligible contacts.
Payout controls are presented before explaining balance/destination prerequisites.
Generic empty states often end with “Your next step starts here” without an action.

**Evidence:** [empty permission dialog](assets/ui-ux-audit/empty-permission-dialog.png);
[permission action, workspace.tsx:893](../app/components/workspace.tsx#L893),
[message action, workspace.tsx:1146](../app/components/workspace.tsx#L1146),
[payout action, workspace.tsx:273](../app/components/workspace.tsx#L273),
[Empty component, ui.tsx:63](../app/components/ui.tsx#L63).

**Improve:** Distinguish empty data, missing prerequisites, age/role restrictions,
and temporarily unavailable features. Explain the next valid action before opening
an impossible form: publish a story, follow a contact, configure a destination,
or wait for funds to clear. Keep enforcement on the server as well.

**Acceptance:** Required selects never present an unexplained zero-option form.
Unavailable actions state why and offer a valid next step when one exists. Verify
new, minor, creator, pending seller, and approved seller account states in both
languages; do not infer eligibility from role alone.

### UX-16 — Notifications report changes without helping users act

**Established by source:** The bell indicates that at least one item is unread,
but each notification renders only title and body. There is no item-level unread
style, timestamp, or destination action. “Mark read” applies to the collection,
and the toggle exposes no expanded state. Users receiving an order, review, or
payout update must infer where to continue.

**Evidence:** [notification renderer, Shell.tsx:411](../app/components/Shell.tsx#L411),
[bell control, Shell.tsx:377](../app/components/Shell.tsx#L377).

**Improve:** Show timestamp and read state per item, and provide an appropriate
destination when supported by the event. Make “Mark all read” explicit. Add
accessible open/closed state and predictable keyboard dismissal/focus behavior.

**Acceptance:** An actionable event takes the user to the relevant record or
surface. Read and unread items are distinguishable without color alone, and a
notification with an unavailable destination has a useful fallback.

## Recommended implementation sequence

The following plan is proposed; this audit has not implemented it.

| Step | Work package                                   | Finding IDs    | Completion gate                                                                                                  |
| ---- | ---------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | Correct misleading state and protect user work | 01–05          | Reproduce each defect, implement the correction, and pass its browser acceptance scenario                        |
| 2    | Repair the commerce journey                    | 06, 07, 13, 14 | Add → review → return-to-context works on desktop/mobile; quantity and money summaries agree with server results |
| 3    | Standardize shared interaction and language    | 08–12          | Shared dialog/tab/control patterns; bilingual journey review; keyboard, target-size, and contrast checks         |
| 4    | Complete prerequisite and follow-up states     | 15, 16         | New/ineligible/empty accounts have useful next steps; events link to the relevant workflow                       |
| 5    | Run a representative usability trial           | All            | No open P1 findings; remaining issues have an owner, decision, and documented acceptance result                  |

Build shared primitives and message/formatting helpers where they remove repeated
inconsistencies. Keep each workflow change independently reviewable. Typed consent
and moderation-case view models are especially valuable: the current broad
`Row = Record<string, any>` allows the wrong domain fields to render without a
type error. A render-level fixture should accompany those contracts.

### Verification checklist for the improvement work

- [ ] Seed representative populated and empty states, including a consent, an
      overdue case with evidence, an existing cart line, held earnings, and no-contact
      and no-published-post accounts.
- [ ] Walk one complete story → tagged product → bag → checkout → order journey
      at desktop and mobile widths; verify quantity, attribution, and final amounts.
- [ ] Walk one draft → leave → recover journey, and a Profile edit interrupted
      by a header preference change.
- [ ] Verify dialogs, tabs, navigation, and notifications using only the keyboard;
      then perform a real screen-reader pass.
- [ ] Review Bangla and English system copy, including errors, status labels,
      long text, money, deadlines, and accessibility names.
- [ ] Check responsive widths of 320, 390, 760, and 1280px, 200% text enlargement,
      reduced motion, and a physical small-screen Android device.
- [ ] Confirm relevant contrast and touch-target measurements after styling changes.
- [ ] Add focused browser regressions for the confirmed defects. Retain server
      integration tests for money, permissions, stock, and retries; neither layer
      substitutes for the other.
- [ ] Update the manual and prior implementation claims after the new behavior
      is actually verified. Record remaining limitations explicitly.

## Evidence inventory

Screenshots use local demo/synthetic data. Some contain the Next.js development
indicator; it is excluded from the product findings. Full-page image heights can
exceed the viewport dimensions listed in the method. Measurements are retained
in [measurements.json](assets/ui-ux-audit/measurements.json); source-derived and
measured conclusions are distinguished above.

| Evidence                                                                      | Purpose                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Ads desktop](assets/ui-ux-audit/ads-desktop.png)                             | Invalid consent metadata; mixed language                                |
| [Spark dialog](assets/ui-ux-audit/spark-dialog.png)                           | Shared modal and language pattern                                       |
| [Empty permission dialog](assets/ui-ux-audit/empty-permission-dialog.png)     | No published-post options with enabled submit                           |
| [Profile language mismatch](assets/ui-ux-audit/profile-language-mismatch.png) | English page with stale Bangla preference field                         |
| [Profile desktop](assets/ui-ux-audit/profile-desktop.png)                     | Baseline settings and payout hierarchy                                  |
| [Feed mobile](assets/ui-ux-audit/feed-mobile.png)                             | Header density and feed controls                                        |
| [Shop desktop](assets/ui-ux-audit/shop-desktop.png)                           | Catalog with side cart                                                  |
| [Shop mobile](assets/ui-ux-audit/shop-mobile.png)                             | Catalog followed by the bag                                             |
| [Checkout desktop](assets/ui-ux-audit/checkout-dialog.png)                    | Missing in-dialog money review                                          |
| [Checkout mobile](assets/ui-ux-audit/checkout-mobile.png)                     | Same confirmation on a narrow viewport                                  |
| [Cut desktop](assets/ui-ux-audit/cut-desktop.png)                             | Editor and preview layout                                               |
| [Cut mobile](assets/ui-ux-audit/cut-mobile.png)                               | Narrow editor and explicit draft action                                 |
| [Seller mobile](assets/ui-ux-audit/seller-mobile.png)                         | Catalog table with inner scrolling                                      |
| [Operations desktop](assets/ui-ux-audit/operations-desktop.png)               | Empty queue and current overview; not evidence of a populated-case test |


---

## P1 resolution

Fixed and verified against a running instance on 9 September 2026, seeded with
a fixture case (critical, two reporters with notes, opened 38 minutes earlier)
because the local queue was empty during the original audit. Verification used
the accessibility tree and DOM state rather than screenshots, which suits these
findings better: three of the five are about what is present in the tree.

| # | Finding | Fix | Verified by |
|---|---|---|---|
| UX-01 | Spark permissions showed moderation metadata and `Invalid Date` | Consent cards render seller, story, an explicit permission sentence and the real `granted_at`; revoke moved to its own action row with its consequence stated. All moderation-only fields removed | Rendered three seeded consents with no `Invalid Date` and no moderation wording; the consent row genuinely carries only `post_id, seller_id, granted_at, trade_name, caption` |
| UX-02 | Operations case cards omitted report evidence and case age | Cards now show report count, opened age, a per-case overdue marker, detected dialect, and each report note with its category and time. Report evidence and appeal statements are styled apart so neither can be mistaken for the other; a case with no notes gets an explicit empty state | Card rendered `2 রিপোর্ট · খোলা হয়েছে ৩৯ মিনিট আগে · জরুরি পর্যালোচনা বাকি · bn_latin` above both notes |
| UX-03 | Closed mobile drawer stayed keyboard-focusable | Interactivity is driven by the `inert` attribute from React state, plus `aria-expanded`/`aria-controls`, focus into the drawer on open, Escape to close, and focus returned to the toggle | At 390px the closed drawer is `inert` and its first control cannot take focus; open → reachable; Escape → `inert` again and focus back on the toggle |
| UX-04 | Header language and the Profile field disagreed | Language and Data Saver are controlled and synced from the account; name and bio stay uncontrolled so a sync cannot discard text being typed. Submit reads the controlled state, not a stale form value | Switching language in the header moved the select from `bn` to `en` while an unsaved name edit survived intact |
| UX-05 | Leaving Cut silently discarded unsaved work | The draft is mirrored to this device's storage, keyed per account, restored on return, cleared on publish, with a visible "kept on this device — not published" line and an explicit Discard | Caption survived navigating to the feed and back; storage key is scoped to the account id; a second account's key was absent |

### A note on the UX-03 fix, because the first attempt was wrong

The first fix used `visibility: hidden` on the closed drawer, which does remove
descendants from the focus order. Verification showed the drawer still
focusable after Escape, and chasing it found the transitions frozen at
`currentTime: 0` — a background window stops compositing, so the animation
clock never advanced.

The CSS was correct; the *approach* was not. Making an accessibility guarantee
depend on a transition completing means the drawer stays focusable for the
200ms it runs, and indefinitely whenever the browser throttles animations.
`inert` is immediate and animation-independent, so the guarantee now holds
regardless. The CSS remains for the visual slide.

### Also fixed while here

Every raw `new Date(x).toLocaleString()` render was replaced with `When` and
`Age` components (`app/components/ui.tsx`). There were seven such call sites,
each capable of printing the literal string "Invalid Date" for a null value —
UX-01 was that bug reaching a user-facing card. Both helpers have an
intentional locale-aware fallback and render Bengali digits for Bangla.
