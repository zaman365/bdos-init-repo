# 04 — BDOS Brand System

**BDOS** — *Bangladesh On Stage*. Said "BEE-doss". Bangla: **বিডস**.
Tagline: **দেখো · কিনো · কামাও** — *Watch · Buy · Earn.*
English lockup: **Your stage. Your shop.**

---

## 1. The idea: the Matra

Bangla's most recognisable structural feature is the **মাত্রা (matra)** — the horizontal
headstroke running across the top of the letters, binding loose shapes into a word. It is
the line everything hangs from. Every Bangla reader knows it without being taught it.
Almost no global technology brand uses an *overline* as its structural device.

That is the identity: **the Matra Line.** A single horizontal bar that sits above things.

- **Wordmark** — BDOS set heavy, with a matra bar running across the top, binding four Latin
  letters with Bangla grammar. Local structure, international form.
- **App icon** — the matra bar over a play triangle. The bar reads simultaneously as a
  headstroke and a stage lighting truss. A stage, in one stroke.
- **In the UI** — section headings are *overlined*, not underlined. Tab indicators sit above
  the label. The live indicator is a matra that pulses. Progress fills left-to-right along
  the matra, the direction Bangla is read and written.
- **In motion** — the matra draws itself left to right. One signature transition, used for
  app launch, section reveals and the end frame of every brand film.

## 2. Colour

Bangladesh's brand colour space is crowded: magenta, orange and red are taken by the
payment and delivery incumbents; blue by telecom. Black plus cyan/magenta belongs to
TikTok. So the palette is chosen for ownability first, meaning second, and screen
performance third.

| Token | Hex | Name | Reserved for |
|---|---|---|---|
| `--delta` | `#00E37A` | **Delta Green** | Primary. Actions, brand, focus |
| `--delta-deep` | `#00A85B` | Delta Deep | Green on light grounds, pressed states |
| `--sonar` | `#FFC24B` | **Sonar Gold** | Money — earnings, commission, gifts, rewards |
| `--padma` | `#FF3B4E` | **Padma Red** | LIVE only. Nothing else, ever |
| `--kalo` | `#0A0C0B` | **Kalo** | The ground. Near-black, faint green bias |
| `--shapla` | `#F2F5F0` | **Shapla** | Light ground / text on dark |

**Delta Green** nods to the flag without literalism, is nearly unused at this chroma by
Bangladeshi consumer brands, and sings against a dark video canvas.
**Sonar Gold** comes from *Sonar Bangla* — golden Bengal, the phrase in the national anthem.
The platform's economics get their own colour: if it is about money, it is gold.
**Padma Red** is the flag's red disc, rationed to a single meaning. Scarcity is what gives it
force; when the whole app is green and gold, one red dot means *something is happening now*.

Greys are mixed toward green (hue ≈ 155, very low saturation) so that neutrals belong to the
family rather than looking like a default. Gradient **Sonar Bhor** (golden dawn),
Delta → Sonar, at most once per screen.

> The discipline: **green moves you, gold pays you, red means live.**
> A colour that can't be explained in three words isn't in the palette.

## 3. Typography

The real problem in Bangladeshi digital products: Bangla gets set in a legacy face
(SolaimanLipi, Nikosh) while Latin gets Roboto. Two unrelated designs, mismatched
x-heights, a broken vertical rhythm. It is the fastest way to look like a knock-off.

**Solution — one superfamily across both scripts: Anek** (Ek Type, SIL Open Font License).
Anek Bangla and Anek Latin are drawn as a single design system across scripts, both variable
with weight *and* width axes.

| Role | Face | Setting |
|---|---|---|
| Display | Anek Latin / Anek Bangla | 700–800, condensed-to-normal width, tight tracking, overlined |
| UI & body | Anek Latin / Anek Bangla | 400 / 500 / 600 |
| Data & specs | IBM Plex Mono | Uppercase labels with generous tracking; IDs, metrics, code |

Money always uses tabular figures. Numerals follow the user's language setting — Bengali
numerals (০১২৩৪) in Bangla, Latin in English — but currency is always `৳` and always
tabular, because ledgers are scanned in columns.

Android fallback stack: `Anek Bangla, Noto Sans Bengali, sans-serif`.
Phase 3: commission a bespoke **BDOS Sans** from a Bangla type foundry, built on Anek's
metrics so it drops in without a relayout.

## 4. Voice

Second person, imperative, short. Bangla that sounds like Dhaka now, not like a textbook.
Buttons say exactly what happens; a confirmation says it happened.

- Yes: "৳420 তোমার bKash-এ গেছে।" — *৳420 has gone to your bKash.*
- No: "Dear valued user, your withdrawal request has been processed successfully."

Numbers are stated plainly. If we take 40% of a gift, the gift screen says we take 40%.

## 5. Photography, illustration and gifts

Real creators, real rooms, real Dhaka light — never stock. Illustration and gift art draw on
rickshaw painting, nakshi kantha and jamdani *as craft to commission from actual artists*,
used in gift art, campaign work and seasonal moments — never as UI wallpaper. The chrome
stays quiet so the content stays loud.

The gift catalogue is where the culture lives: **Shapla** ৳10 · **Rickshaw** ৳50 ·
**Nauka** ৳100 · **Ilish** ৳500 · **Kacchi** ৳1,000 · **Royal Bengal** ৳5,000 ·
**Padma Setu** ৳20,000.

## 6. Sound and haptics

A 1.2-second sonic logo: a plucked ektara upstroke resolving into a sub-bass note — folk
instrument, modern low end, the whole positioning in one gesture. Distinct haptic for gift
send and for a cleared payout, because those are the two moments people should feel.

## 7. Never

- Flag literalism — no red disc on a green field.
- Rickshaw-art pastiche as interface chrome.
- Bangla set in a Latin-first typeface.
- Padma Red used for anything that is not live.
- Stock photography of people who have never been to Bangladesh.
