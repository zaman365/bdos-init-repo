# 03 — Design guidelines

The full identity rationale is in [../04-brand-system.md](../04-brand-system.md).
This document is how to apply it without eroding it.

## The Matra

Bangla's **মাত্রা** — the headstroke binding letters into a word — is the
brand's structural device. It is the reason the identity reads as ours and not
as a translated Western product.

- Section headings are **overlined**, never underlined.
- Tab indicators sit **above** the label.
- Progress fills **left to right**, the direction Bangla is read.
- The bar draws itself left to right on load. One signature transition, reused
  everywhere, rather than a different animation per screen.

Do not invent a second structural device. The whole value of one motif is that
it is one.

## Colour, and what each colour is allowed to mean

| Token | Hex | Allowed use |
|---|---|---|
| Delta Green | `#00E37A` | Primary actions, brand, focus rings |
| Sonar Gold | `#FFC24B` | **Money only** — earnings, commission, gifts, rewards |
| Padma Red | `#FF3B4E` | **LIVE only** — nothing else, ever |
| Kalo | `#0A0C0B` | The ground |
| Shapla | `#F2F5F0` | Light ground, text on dark |

> Green moves you. Gold pays you. Red means live.

Red is rationed on purpose: when the whole interface is green and gold, one red
dot means *something is happening now*. Spending red on an error state or a
delete button destroys that, permanently and for everyone. Semantic error
colours come from the neutral ramp with weight and iconography, not from Padma.

Neutrals are mixed toward green (hue ≈ 155, very low saturation) so they read
as chosen rather than inherited.

## Typography

One superfamily across both scripts: **Anek** (Anek Bangla + Anek Latin, SIL
Open Font License). This is the single highest-leverage design decision in the
product.

The failure to avoid: Bangla set in a legacy face (SolaimanLipi, Nikosh) beside
Latin in Roboto. Two unrelated designs, mismatched x-heights, a broken vertical
rhythm — it is the fastest way to look like a knock-off, and Bangladeshi users
recognise it instantly.

- Display: 700–800, condensed-to-normal width, tight tracking, overlined.
- UI and body: 400 / 500 / 600.
- Data, labels, IDs: IBM Plex Mono, uppercase with generous tracking.
- Android fallback stack: `Anek Bangla, Noto Sans Bengali, sans-serif`.

**Money always uses tabular figures.** Numerals follow the user's language
setting — Bengali (০১২৩৪) in Bangla, Latin in English — but the currency mark
is always `৳` and always tabular, because ledgers are read in columns.

## Interface rules

- Content is loud, chrome is quiet. The feed is the product; the interface
  around it should be nearly invisible.
- Every interactive element has a visible keyboard focus state.
- Respect `prefers-reduced-motion`. The matra draw is decorative; it stops.
- Contrast: body text ≥ 4.5:1, large text ≥ 3:1, in both themes. Delta Green on
  Kalo passes; Delta Green on Shapla does not — use Delta Deep `#00A85B` on
  light grounds.
- Touch targets ≥ 44px. Much of the audience is on a cracked 5-inch screen on a
  moving bus.
- Wide content (tables, code, diagrams) scrolls inside its own container. The
  page body never scrolls sideways.

## Performance is a design constraint

- APK under 40MB. A heavy app is not an inconvenience here, it is an uninstall.
- Cold start under two seconds on a 2GB device.
- 480p default on cellular. Bandwidth is simultaneously our largest variable
  cost and the users' loudest complaint.
- Images and art ship as SVG or optimised raster; no decorative video.

## Never

Flag literalism (no red disc on a green field). Rickshaw-art pastiche as
interface wallpaper — commission the artists for gifts and campaigns instead.
Bangla in a Latin-first typeface. Padma Red for anything that is not live.
Stock photography of people who have never been to Bangladesh.
