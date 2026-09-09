/**
 * BDOS ledger — business events expressed as balanced double-entry journals.
 *
 * Sign convention matches db/migrations/005_ledger.sql:
 *   positive amount = DEBIT, negative amount = CREDIT, every entry sums to 0.
 *
 * These functions are pure: they take a business event and return an Entry.
 * Nothing here touches a database, which is what makes the money rules
 * testable in isolation. The SQL layer enforces the same invariants again,
 * because a rule that lives in only one place is a rule that will be bypassed.
 *
 * See docs/guidelines/04-money.md.
 */

import { type Paisa, type BasisPoints, assertPaisa, splitBp, shareBp, vat, withhold, VAT_BP } from "../../money/src/index.ts";

export type AccountKind =
  | "cash_mfs" | "cod_receivable"
  | "escrow" | "seller_payable" | "creator_payable" | "commission_held"
  | "gift_liability" | "coin_liability" | "tax_withheld" | "courier_payable"
  | "platform_revenue" | "refund_expense" | "rto_expense";

export type EntryKind =
  | "order_paid_into_escrow" | "cod_collected" | "escrow_released_to_seller"
  | "commission_accrued" | "commission_cleared" | "commission_clawed_back"
  | "refund_issued" | "rto_cost_absorbed"
  | "coins_purchased" | "gift_sent" | "gift_cleared"
  | "payout_executed" | "tax_remitted" | "manual_correction";

const DEBIT_POSITIVE: ReadonlySet<AccountKind> = new Set<AccountKind>([
  "cash_mfs", "cod_receivable", "refund_expense", "rto_expense",
]);

export function normalSide(kind: AccountKind): "debit" | "credit" {
  return DEBIT_POSITIVE.has(kind) ? "debit" : "credit";
}

export interface AccountRef {
  kind: AccountKind;
  /** Party id for per-party accounts; omitted for platform-wide accounts. */
  owner?: string;
}

export interface Line {
  account: AccountRef;
  /** Signed paisa: + debit, - credit. */
  amount: Paisa;
  memo?: string;
}

export interface Entry {
  kind: EntryKind;
  idempotencyKey: string;
  description: string;
  lines: Line[];
  orderId?: string;
}

export class LedgerError extends Error {}

/** Policy constants. Every one of these is published to the party it affects. */
export const POLICY = {
  /** Commission stays held until the return window closes. */
  returnWindowDays: 7,
  /** Source tax withheld on creator/affiliate earnings. */
  withholdingBp: 1_000 as BasisPoints,
  /** VAT on marketplace commission. */
  vatBp: VAT_BP,
  /** Creator's share of every gift. Printed on the gift sheet. */
  giftCreatorBp: 6_000 as BasisPoints,
} as const;

/**
 * Validate and freeze an entry. This is the only way to construct one, so a
 * malformed journal cannot exist in memory, let alone reach the database.
 */
export function buildEntry(e: Entry): Entry {
  if (!e.idempotencyKey || e.idempotencyKey.trim() === "") {
    throw new LedgerError("every entry needs an idempotency key");
  }
  if (e.lines.length < 2) {
    throw new LedgerError(`entry "${e.idempotencyKey}" has ${e.lines.length} line(s); double-entry needs at least 2`);
  }
  let sum = 0;
  for (const l of e.lines) {
    assertPaisa(l.amount, `line on ${l.account.kind}`);
    if (l.amount === 0) {
      throw new LedgerError(`entry "${e.idempotencyKey}" has a zero-value line on ${l.account.kind}`);
    }
    sum += l.amount;
  }
  if (sum !== 0) {
    throw new LedgerError(`entry "${e.idempotencyKey}" is out of balance by ${sum} paisa`);
  }
  return Object.freeze({ ...e, lines: Object.freeze([...e.lines]) as Line[] });
}

const debit = (kind: AccountKind, amount: Paisa, owner?: string, memo?: string): Line =>
  ({ account: { kind, owner }, amount, memo });
const credit = (kind: AccountKind, amount: Paisa, owner?: string, memo?: string): Line =>
  ({ account: { kind, owner }, amount: -amount, memo });

// ── order money-in ──────────────────────────────────────────────────────────

export interface OrderMoneyIn {
  orderId: string;
  /** What the buyer actually pays: goods + delivery - discount. */
  payablePaisa: Paisa;
  method: "cod" | "digital";
}

/**
 * Buyer money arrives and is HELD. Escrow is a legal requirement, not a
 * product decision: it is released only against delivery confirmation.
 */
export function orderMoneyIn(o: OrderMoneyIn): Entry {
  if (o.payablePaisa <= 0) throw new LedgerError("payable must be positive");
  const asset: AccountKind = o.method === "cod" ? "cod_receivable" : "cash_mfs";
  return buildEntry({
    kind: o.method === "cod" ? "cod_collected" : "order_paid_into_escrow",
    idempotencyKey: `order:${o.orderId}:money-in`,
    description: o.method === "cod"
      ? `COD collected for order ${o.orderId}, held in escrow`
      : `Payment received for order ${o.orderId}, held in escrow`,
    orderId: o.orderId,
    lines: [
      debit(asset, o.payablePaisa, undefined, o.method),
      credit("escrow", o.payablePaisa, undefined, "held until delivery"),
    ],
  });
}

// ── escrow release ──────────────────────────────────────────────────────────

export interface EscrowRelease {
  orderId: string;
  sellerId: string;
  goodsPaisa: Paisa;
  deliveryPaisa: Paisa;
  /** Seller's marketplace commission rate, by category. */
  commissionBp: BasisPoints;
  courierId: string;
}

export interface EscrowReleaseResult {
  entry: Entry;
  commissionPaisa: Paisa;
  vatPaisa: Paisa;
  sellerNetPaisa: Paisa;
}

/**
 * Delivery confirmed: the held money is split and released.
 * Commission is ours, VAT on that commission is NBR's, the delivery charge is
 * the courier's, and the remainder is the seller's.
 */
export function releaseEscrow(r: EscrowRelease): EscrowReleaseResult {
  const held = r.goodsPaisa + r.deliveryPaisa;
  if (held <= 0) throw new LedgerError("nothing to release");
  const commissionPaisa = shareBp(r.goodsPaisa, r.commissionBp);
  const vatPaisa = vat(commissionPaisa, POLICY.vatBp);
  const sellerNetPaisa = r.goodsPaisa - commissionPaisa - vatPaisa;
  if (sellerNetPaisa < 0) throw new LedgerError("commission plus VAT exceeds the goods value");

  const lines: Line[] = [
    debit("escrow", held, undefined, `release for order ${r.orderId}`),
    credit("seller_payable", sellerNetPaisa, r.sellerId, "goods net of commission and VAT"),
  ];
  if (commissionPaisa > 0) lines.push(credit("platform_revenue", commissionPaisa, undefined, `${r.commissionBp}bp commission`));
  if (vatPaisa > 0) lines.push(credit("tax_withheld", vatPaisa, undefined, "VAT on commission"));
  if (r.deliveryPaisa > 0) lines.push(credit("courier_payable", r.deliveryPaisa, r.courierId, "delivery charge"));

  return {
    entry: buildEntry({
      kind: "escrow_released_to_seller",
      idempotencyKey: `order:${r.orderId}:escrow-release`,
      description: `Escrow released for order ${r.orderId}`,
      orderId: r.orderId,
      lines,
    }),
    commissionPaisa, vatPaisa, sellerNetPaisa,
  };
}

// ── affiliate commission ────────────────────────────────────────────────────

export interface CommissionAccrual {
  orderId: string;
  orderItemId: string;
  creatorId: string;
  goodsPaisa: Paisa;
  rateBp: BasisPoints;
  deliveredAt: Date;
}

export interface CommissionAccrualResult {
  entry: Entry;
  commissionPaisa: Paisa;
  withholdingPaisa: Paisa;
  netPaisa: Paisa;
  /** Shown plainly in the creator app. An invisible hold reads as theft. */
  holdUntil: Date;
}

/**
 * The affiliate creator earns. This is customer-acquisition cost, so it is
 * booked against platform revenue, and it is HELD until the return window
 * closes — a refund would otherwise pay commission on a sale that unwound.
 */
export function accrueCommission(c: CommissionAccrual): CommissionAccrualResult {
  const commissionPaisa = shareBp(c.goodsPaisa, c.rateBp);
  if (commissionPaisa === 0) throw new LedgerError("commission rounds to zero; do not post an empty accrual");
  const withholdingPaisa = withhold(commissionPaisa, POLICY.withholdingBp);
  const netPaisa = commissionPaisa - withholdingPaisa;

  const holdUntil = new Date(c.deliveredAt.getTime() + POLICY.returnWindowDays * 86_400_000);

  const lines: Line[] = [
    debit("platform_revenue", commissionPaisa, undefined, `affiliate CAC ${c.rateBp}bp`),
    credit("commission_held", netPaisa, c.creatorId, `held until ${holdUntil.toISOString().slice(0, 10)}`),
  ];
  if (withholdingPaisa > 0) lines.push(credit("tax_withheld", withholdingPaisa, undefined, "source tax on commission"));

  return {
    entry: buildEntry({
      kind: "commission_accrued",
      idempotencyKey: `item:${c.orderItemId}:commission-accrued`,
      description: `Commission accrued to ${c.creatorId} for item ${c.orderItemId}`,
      orderId: c.orderId,
      lines,
    }),
    commissionPaisa, withholdingPaisa, netPaisa, holdUntil,
  };
}

/** The return window closed without a refund: the money becomes withdrawable. */
export function clearCommission(a: { orderItemId: string; creatorId: string; netPaisa: Paisa }): Entry {
  if (a.netPaisa <= 0) throw new LedgerError("nothing to clear");
  return buildEntry({
    kind: "commission_cleared",
    idempotencyKey: `item:${a.orderItemId}:commission-cleared`,
    description: `Commission cleared for withdrawal by ${a.creatorId}`,
    lines: [
      debit("commission_held", a.netPaisa, a.creatorId, "hold expired"),
      credit("creator_payable", a.netPaisa, a.creatorId, "withdrawable"),
    ],
  });
}

/** The order unwound inside the window, or fraud review rejected it. */
export function clawBackCommission(a: {
  orderItemId: string; creatorId: string; commissionPaisa: Paisa;
  withholdingPaisa: Paisa; reason: string;
}): Entry {
  const net = a.commissionPaisa - a.withholdingPaisa;
  const lines: Line[] = [
    debit("commission_held", net, a.creatorId, a.reason),
    credit("platform_revenue", a.commissionPaisa, undefined, "CAC recovered"),
  ];
  if (a.withholdingPaisa > 0) lines.push(debit("tax_withheld", a.withholdingPaisa, undefined, "withholding reversed"));
  return buildEntry({
    kind: "commission_clawed_back",
    idempotencyKey: `item:${a.orderItemId}:commission-clawback`,
    description: `Commission clawed back from ${a.creatorId}: ${a.reason}`,
    lines,
  });
}

// ── failure paths ───────────────────────────────────────────────────────────

/**
 * Return to origin: nothing was delivered, so no escrow was ever funded on a
 * COD order — but the courier still charges for the attempt. RTO is the single
 * biggest drag on commerce margin (docs/06 §4), so it gets its own expense
 * account and is never buried in "other".
 */
export function absorbRtoCost(a: { orderId: string; courierId: string; costPaisa: Paisa }): Entry {
  if (a.costPaisa <= 0) throw new LedgerError("RTO cost must be positive");
  return buildEntry({
    kind: "rto_cost_absorbed",
    idempotencyKey: `order:${a.orderId}:rto`,
    description: `RTO cost absorbed for order ${a.orderId}`,
    orderId: a.orderId,
    lines: [
      debit("rto_expense", a.costPaisa, undefined, "failed delivery"),
      credit("courier_payable", a.costPaisa, a.courierId, "attempt charge"),
    ],
  });
}

/**
 * Refund after escrow release. The seller gives back the goods value; the
 * platform absorbs whatever it cannot recover (typically the delivery leg).
 */
export function issueRefund(a: {
  orderId: string; sellerId: string; refundPaisa: Paisa;
  recoverFromSellerPaisa: Paisa;
}): Entry {
  if (a.refundPaisa <= 0) throw new LedgerError("refund must be positive");
  if (a.recoverFromSellerPaisa > a.refundPaisa) throw new LedgerError("cannot recover more than the refund");
  const absorbed = a.refundPaisa - a.recoverFromSellerPaisa;
  const lines: Line[] = [
    credit("cash_mfs", a.refundPaisa, undefined, `refund for order ${a.orderId}`),
  ];
  if (a.recoverFromSellerPaisa > 0) lines.push(debit("seller_payable", a.recoverFromSellerPaisa, a.sellerId, "refund recovered"));
  if (absorbed > 0) lines.push(debit("refund_expense", absorbed, undefined, "platform absorbed"));
  return buildEntry({
    kind: "refund_issued",
    idempotencyKey: `order:${a.orderId}:refund`,
    description: `Refund issued for order ${a.orderId}`,
    orderId: a.orderId,
    lines,
  });
}

// ── gifts ──────────────────────────────────────────────────────────────────

export interface GiftResult {
  entry: Entry;
  creatorPaisa: Paisa;
  platformPaisa: Paisa;
}

/**
 * A gift is sent. Coins were already sold (a prepaid liability), so this
 * converts coin liability into a creator share and platform revenue at the
 * PUBLISHED split. The split is a product promise; it lives in POLICY, not in
 * a config file someone can quietly change.
 */
export function sendGift(g: {
  sendId: string; hostId: string; senderId: string; grossPaisa: Paisa;
}): GiftResult {
  if (g.hostId === g.senderId) throw new LedgerError("a host cannot gift themselves");
  if (g.grossPaisa <= 0) throw new LedgerError("gift value must be positive");
  const [creatorPaisa, platformPaisa] = splitBp(g.grossPaisa, POLICY.giftCreatorBp);

  const lines: Line[] = [debit("coin_liability", g.grossPaisa, undefined, "coins spent")];
  if (creatorPaisa > 0) lines.push(credit("gift_liability", creatorPaisa, g.hostId, `${POLICY.giftCreatorBp / 100}% creator share`));
  if (platformPaisa > 0) lines.push(credit("platform_revenue", platformPaisa, undefined, "platform share"));

  return {
    entry: buildEntry({
      kind: "gift_sent",
      idempotencyKey: `gift:${g.sendId}`,
      description: `Gift to ${g.hostId}`,
      lines,
    }),
    creatorPaisa, platformPaisa,
  };
}

// ── payouts ─────────────────────────────────────────────────────────────────

/**
 * Money actually leaves for a creator's bKash. Payout success rate is a launch
 * gate at 99.5% (docs/06 P3) because one failed withdrawal ends a creator
 * relationship permanently.
 */
export function executePayout(p: {
  payoutId: string; payeeId: string; amountPaisa: Paisa;
  from: "creator_payable" | "gift_liability" | "seller_payable";
}): Entry {
  if (p.amountPaisa <= 0) throw new LedgerError("payout must be positive");
  return buildEntry({
    kind: "payout_executed",
    idempotencyKey: `payout:${p.payoutId}`,
    description: `Payout to ${p.payeeId}`,
    lines: [
      debit(p.from, p.amountPaisa, p.payeeId, "withdrawn"),
      credit("cash_mfs", p.amountPaisa, undefined, "sent to MFS"),
    ],
  });
}

// ── an in-memory book, for tests and local development ──────────────────────

export interface BalanceKey { kind: AccountKind; owner?: string }

export class Book {
  private readonly seen = new Set<string>();
  private readonly sums = new Map<string, Paisa>();
  readonly entries: Entry[] = [];

  private static key(a: AccountRef): string {
    return a.owner ? `${a.kind}:${a.owner}` : a.kind;
  }

  /** Idempotent by design: replaying an event is a no-op, not a double-post. */
  post(entry: Entry): { posted: boolean } {
    if (this.seen.has(entry.idempotencyKey)) return { posted: false };
    this.seen.add(entry.idempotencyKey);
    this.entries.push(entry);
    for (const l of entry.lines) {
      const k = Book.key(l.account);
      this.sums.set(k, (this.sums.get(k) ?? 0) + l.amount);
    }
    return { posted: true };
  }

  /**
   * Balance in the account's natural direction.
   *
   * Negating a zero produces -0 in JavaScript, which is not strictly equal to
   * 0 and would surface as "-0" in a creator's statement. Normalise it away.
   */
  balance(kind: AccountKind, owner?: string): Paisa {
    const raw = this.sums.get(owner ? `${kind}:${owner}` : kind) ?? 0;
    const signed = normalSide(kind) === "debit" ? raw : -raw;
    return signed === 0 ? 0 : signed;
  }

  /** The whole book must always sum to zero. Anything else is a bug. */
  drift(): Paisa {
    let total = 0;
    for (const v of this.sums.values()) total += v;
    return total === 0 ? 0 : total;
  }
}
