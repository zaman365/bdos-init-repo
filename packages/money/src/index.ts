/**
 * BDOS money primitives.
 *
 * Rule 1: money is an integer number of paisa. 1 BDT = 100 paisa.
 *         There is no float money anywhere in this codebase.
 * Rule 2: every split is EXACT. The parts of a division always sum back to
 *         the whole — the remainder is assigned, never discarded.
 * Rule 3: every rounding direction is named and deliberate. See splitBp.
 *
 * See docs/guidelines/04-money.md.
 */

/** An integer count of paisa. Negative is allowed (ledger lines are signed). */
export type Paisa = number;

/** Basis points. 10_000 bp = 100%. Commission rates live in bp, never in floats. */
export type BasisPoints = number;

export class MoneyError extends Error {}

export function assertPaisa(v: number, label = "amount"): Paisa {
  if (!Number.isInteger(v)) {
    throw new MoneyError(`${label} must be whole paisa, got ${v}`);
  }
  if (!Number.isSafeInteger(v)) {
    throw new MoneyError(`${label} exceeds safe integer range: ${v}`);
  }
  return v;
}

export function assertBp(bp: number): BasisPoints {
  if (!Number.isInteger(bp) || bp < 0 || bp > 10_000) {
    throw new MoneyError(`basis points must be an integer in 0..10000, got ${bp}`);
  }
  return bp;
}

/** 14.50 BDT -> 1450 paisa. Rejects fractions of a paisa outright. */
export function taka(amount: number): Paisa {
  if (!Number.isFinite(amount)) throw new MoneyError("amount must be finite");
  const p = Math.round(amount * 100);
  assertPaisa(p);
  if (Math.abs(amount * 100 - p) > 1e-9) {
    throw new MoneyError(`${amount} BDT is not a whole number of paisa`);
  }
  return p;
}

/**
 * Split `total` at `bp`, returning [share, remainder] such that
 * share + remainder === total, exactly, always.
 *
 * `share` is floored, so the party whose cut is expressed in bp never receives
 * a rounded-up paisa the platform has not collected. The rounding crumb lands
 * in `remainder`. This is why gift and commission splits can never drift.
 */
export function splitBp(total: Paisa, bp: BasisPoints): [Paisa, Paisa] {
  assertPaisa(total, "total");
  assertBp(bp);
  if (total < 0) throw new MoneyError(`splitBp expects a non-negative total, got ${total}`);
  const share = Number((BigInt(total) * BigInt(bp)) / 10_000n);
  return [share, total - share];
}

/** The `bp` share of `total`, floored. Shorthand for splitBp(...)[0]. */
export function shareBp(total: Paisa, bp: BasisPoints): Paisa {
  return splitBp(total, bp)[0];
}

/**
 * Distribute `total` across `weights` with no paisa lost.
 * Uses largest-remainder: floor every share, then hand the leftover paisa to
 * the largest fractional parts. sum(result) === total, guaranteed.
 */
export function allocate(total: Paisa, weights: number[]): Paisa[] {
  assertPaisa(total, "total");
  if (weights.length === 0) throw new MoneyError("allocate needs at least one weight");
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) throw new MoneyError("weights must be non-negative");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new MoneyError("weights must sum to more than zero");

  if (total < 0 || !Number.isSafeInteger(sum)) throw new MoneyError("allocation must be nonnegative and weights sum must be safe");
  const numerators = weights.map((w) => BigInt(total) * BigInt(w));
  const floors = numerators.map((n) => Number(n / BigInt(sum)));
  let leftover = total - floors.reduce((a, b) => a + b, 0);

  const order = numerators
    .map((v, i) => ({ i, frac: v % BigInt(sum) }))
    .sort((a, b) => a.frac === b.frac ? a.i - b.i : a.frac > b.frac ? -1 : 1);

  const out = [...floors];
  for (let k = 0; leftover > 0; k = (k + 1) % order.length) {
    out[order[k].i] += 1;
    leftover -= 1;
  }
  return out;
}

/** Bangladesh VAT on marketplace commission. Rounded half-up, NBR convention. */
export const VAT_BP: BasisPoints = 500; // 5%

export function vat(base: Paisa, bp: BasisPoints = VAT_BP): Paisa {
  assertPaisa(base, "base");
  assertBp(bp);
  if (base < 0) throw new MoneyError("tax base must be nonnegative");
  return Number((BigInt(base) * BigInt(bp) + 5000n) / 10000n);
}

/**
 * Source tax withheld from a creator or affiliate payment.
 * Withholding is computed on the gross and rounded half-up, because the
 * liability is owed to NBR and under-withholding is the platform's problem.
 */
export function withhold(gross: Paisa, bp: BasisPoints): Paisa {
  assertPaisa(gross, "gross");
  assertBp(bp);
  if (gross < 0) throw new MoneyError("gross must be nonnegative");
  const w = Number((BigInt(gross) * BigInt(bp) + 5000n) / 10000n);
  return Math.min(w, gross);
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Latin digits -> Bengali digits. Locale switch, not a display hack. */
export function toBengaliDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/**
 * Format paisa for display. Always two decimals and always the ৳ sign;
 * ledgers are read in columns, so the shape must not vary by amount.
 */
export function formatTaka(p: Paisa, locale: "bn" | "en" = "bn"): string {
  assertPaisa(p, "amount");
  const neg = p < 0;
  const abs = Math.abs(p);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = whole.toLocaleString("en-US");
  const body = `৳${grouped}.${String(frac).padStart(2, "0")}`;
  const signed = neg ? `-${body}` : body;
  return locale === "bn" ? toBengaliDigits(signed) : signed;
}
