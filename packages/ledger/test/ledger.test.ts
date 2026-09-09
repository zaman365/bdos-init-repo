import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildEntry, orderMoneyIn, releaseEscrow, accrueCommission, clearCommission,
  clawBackCommission, absorbRtoCost, issueRefund, sendGift, executePayout,
  Book, LedgerError, POLICY, normalSide,
} from "../src/index.ts";

const SELLER = "seller-bogura";
const CREATOR = "creator-nusrat";
const COURIER = "courier-pathao";
const DELIVERED = new Date("2026-09-01T10:00:00Z");

describe("buildEntry — malformed journals cannot exist", () => {
  test("rejects a single-line entry", () => {
    assert.throws(() => buildEntry({
      kind: "manual_correction", idempotencyKey: "k", description: "d",
      lines: [{ account: { kind: "cash_mfs" }, amount: 100 }],
    }), /at least 2/);
  });

  test("rejects an unbalanced entry", () => {
    assert.throws(() => buildEntry({
      kind: "manual_correction", idempotencyKey: "k", description: "d",
      lines: [
        { account: { kind: "cash_mfs" }, amount: 100 },
        { account: { kind: "escrow" }, amount: -99 },
      ],
    }), /out of balance by 1 paisa/);
  });

  test("rejects a zero-value line", () => {
    assert.throws(() => buildEntry({
      kind: "manual_correction", idempotencyKey: "k", description: "d",
      lines: [
        { account: { kind: "cash_mfs" }, amount: 0 },
        { account: { kind: "escrow" }, amount: 0 },
      ],
    }), /zero-value line/);
  });

  test("rejects a missing idempotency key", () => {
    assert.throws(() => buildEntry({
      kind: "manual_correction", idempotencyKey: "  ", description: "d",
      lines: [
        { account: { kind: "cash_mfs" }, amount: 100 },
        { account: { kind: "escrow" }, amount: -100 },
      ],
    }), /idempotency key/);
  });

  test("accepts a balanced entry and freezes it", () => {
    const e = buildEntry({
      kind: "manual_correction", idempotencyKey: "k", description: "d",
      lines: [
        { account: { kind: "cash_mfs" }, amount: 100 },
        { account: { kind: "escrow" }, amount: -100 },
      ],
    });
    assert.equal(e.lines.length, 2);
    assert.throws(() => { (e.lines as any).push({}); });
  });
});

describe("account directions", () => {
  test("assets and expenses are debit-positive, everything else credit-positive", () => {
    assert.equal(normalSide("cash_mfs"), "debit");
    assert.equal(normalSide("cod_receivable"), "debit");
    assert.equal(normalSide("rto_expense"), "debit");
    assert.equal(normalSide("escrow"), "credit");
    assert.equal(normalSide("platform_revenue"), "credit");
    assert.equal(normalSide("creator_payable"), "credit");
  });
});

describe("escrow release — the worked ৳1,400 order", () => {
  // goods ৳1,400 + delivery ৳60, seller commission 6%, VAT 5% on commission.
  const r = releaseEscrow({
    orderId: "o1", sellerId: SELLER, goodsPaisa: 140_000, deliveryPaisa: 6_000,
    commissionBp: 600, courierId: COURIER,
  });

  test("commission is ৳84 and VAT on it is ৳4.20", () => {
    assert.equal(r.commissionPaisa, 8_400);
    assert.equal(r.vatPaisa, 420);
  });

  test("the seller nets goods minus commission minus VAT", () => {
    assert.equal(r.sellerNetPaisa, 140_000 - 8_400 - 420);
    assert.equal(r.sellerNetPaisa, 131_180);
  });

  test("every paisa held is accounted for", () => {
    const credits = r.entry.lines.filter((l) => l.amount < 0)
      .reduce((a, l) => a + -l.amount, 0);
    assert.equal(credits, 146_000);
    assert.equal(r.sellerNetPaisa + r.commissionPaisa + r.vatPaisa + 6_000, 146_000);
  });

  test("refuses to release when commission would exceed the goods", () => {
    assert.throws(() => releaseEscrow({
      orderId: "o2", sellerId: SELLER, goodsPaisa: 10, deliveryPaisa: 0,
      commissionBp: 10_000, courierId: COURIER,
    }), LedgerError);
  });
});

describe("affiliate commission", () => {
  const a = accrueCommission({
    orderId: "o1", orderItemId: "i1", creatorId: CREATOR,
    goodsPaisa: 140_000, rateBp: 300, deliveredAt: DELIVERED,
  });

  test("3% of ৳1,400 is ৳42, less 10% withholding leaves ৳37.80", () => {
    assert.equal(a.commissionPaisa, 4_200);
    assert.equal(a.withholdingPaisa, 420);
    assert.equal(a.netPaisa, 3_780);
  });

  test("the hold runs to the end of the return window", () => {
    const days = (a.holdUntil.getTime() - DELIVERED.getTime()) / 86_400_000;
    assert.equal(days, POLICY.returnWindowDays);
  });

  test("refuses to post an accrual that rounds to zero", () => {
    assert.throws(() => accrueCommission({
      orderId: "o1", orderItemId: "i2", creatorId: CREATOR,
      goodsPaisa: 10, rateBp: 1, deliveredAt: DELIVERED,
    }), /rounds to zero/);
  });

  test("clearing moves held money to withdrawable", () => {
    const e = clearCommission({ orderItemId: "i1", creatorId: CREATOR, netPaisa: 3_780 });
    assert.equal(e.lines.find((l) => l.account.kind === "commission_held")!.amount, 3_780);
    assert.equal(e.lines.find((l) => l.account.kind === "creator_payable")!.amount, -3_780);
  });

  test("a clawback returns the full commission to revenue and reverses withholding", () => {
    const e = clawBackCommission({
      orderItemId: "i1", creatorId: CREATOR, commissionPaisa: 4_200,
      withholdingPaisa: 420, reason: "buyer returned the item",
    });
    assert.equal(e.lines.find((l) => l.account.kind === "platform_revenue")!.amount, -4_200);
    assert.equal(e.lines.reduce((s, l) => s + l.amount, 0), 0);
  });
});

describe("gifts", () => {
  test("the published 60/40 split, exactly", () => {
    const g = sendGift({ sendId: "g1", hostId: CREATOR, senderId: "fan", grossPaisa: 100_000 });
    assert.equal(g.creatorPaisa, 60_000);
    assert.equal(g.platformPaisa, 40_000);
    assert.equal(g.creatorPaisa + g.platformPaisa, 100_000);
  });

  test("a host cannot gift themselves", () => {
    assert.throws(() => sendGift({
      sendId: "g2", hostId: CREATOR, senderId: CREATOR, grossPaisa: 1_000,
    }), /cannot gift themselves/);
  });

  test("the split never loses a paisa across the whole catalogue", () => {
    for (const price of [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 2_000_000]) {
      const g = sendGift({ sendId: `g-${price}`, hostId: CREATOR, senderId: "fan", grossPaisa: price });
      assert.equal(g.creatorPaisa + g.platformPaisa, price);
    }
  });
});

describe("failure paths", () => {
  test("RTO cost lands in its own expense account", () => {
    const e = absorbRtoCost({ orderId: "o9", courierId: COURIER, costPaisa: 6_000 });
    assert.equal(e.lines.find((l) => l.account.kind === "rto_expense")!.amount, 6_000);
  });

  test("a refund splits between seller recovery and platform absorption", () => {
    const e = issueRefund({
      orderId: "o1", sellerId: SELLER, refundPaisa: 146_000,
      recoverFromSellerPaisa: 140_000,
    });
    assert.equal(e.lines.find((l) => l.account.kind === "refund_expense")!.amount, 6_000);
    assert.equal(e.lines.reduce((s, l) => s + l.amount, 0), 0);
  });

  test("cannot recover more than was refunded", () => {
    assert.throws(() => issueRefund({
      orderId: "o1", sellerId: SELLER, refundPaisa: 100, recoverFromSellerPaisa: 200,
    }), /cannot recover more/);
  });
});

describe("full lifecycle — happy path", () => {
  const book = new Book();
  book.post(orderMoneyIn({ orderId: "o1", payablePaisa: 146_000, method: "cod" }));
  const rel = releaseEscrow({
    orderId: "o1", sellerId: SELLER, goodsPaisa: 140_000, deliveryPaisa: 6_000,
    commissionBp: 600, courierId: COURIER,
  });
  book.post(rel.entry);
  const acc = accrueCommission({
    orderId: "o1", orderItemId: "i1", creatorId: CREATOR,
    goodsPaisa: 140_000, rateBp: 300, deliveredAt: DELIVERED,
  });
  book.post(acc.entry);
  book.post(clearCommission({ orderItemId: "i1", creatorId: CREATOR, netPaisa: acc.netPaisa }));
  book.post(executePayout({
    payoutId: "p1", payeeId: CREATOR, amountPaisa: acc.netPaisa, from: "creator_payable",
  }));

  test("the book balances to zero", () => {
    assert.equal(book.drift(), 0);
  });

  test("escrow is emptied and the creator is fully paid out", () => {
    assert.equal(book.balance("escrow"), 0);
    assert.equal(book.balance("commission_held", CREATOR), 0);
    assert.equal(book.balance("creator_payable", CREATOR), 0);
  });

  test("platform keeps ৳42 — the ৳84 commission less the ৳42 affiliate CAC", () => {
    assert.equal(book.balance("platform_revenue"), 4_200);
  });

  test("the seller is owed ৳1,311.80 and the courier ৳60", () => {
    assert.equal(book.balance("seller_payable", SELLER), 131_180);
    assert.equal(book.balance("courier_payable", COURIER), 6_000);
  });

  test("৳8.40 of tax is withheld — VAT plus source tax", () => {
    assert.equal(book.balance("tax_withheld"), 420 + 420);
  });
});

describe("full lifecycle — refund path", () => {
  const book = new Book();
  book.post(orderMoneyIn({ orderId: "o2", payablePaisa: 146_000, method: "digital" }));
  book.post(releaseEscrow({
    orderId: "o2", sellerId: SELLER, goodsPaisa: 140_000, deliveryPaisa: 6_000,
    commissionBp: 600, courierId: COURIER,
  }).entry);
  const acc = accrueCommission({
    orderId: "o2", orderItemId: "i2", creatorId: CREATOR,
    goodsPaisa: 140_000, rateBp: 300, deliveredAt: DELIVERED,
  });
  book.post(acc.entry);
  // Buyer returns inside the window: refund, and the commission never clears.
  book.post(issueRefund({
    orderId: "o2", sellerId: SELLER, refundPaisa: 146_000, recoverFromSellerPaisa: 140_000,
  }));
  book.post(clawBackCommission({
    orderItemId: "i2", creatorId: CREATOR, commissionPaisa: acc.commissionPaisa,
    withholdingPaisa: acc.withholdingPaisa, reason: "returned inside window",
  }));

  test("the book still balances", () => {
    assert.equal(book.drift(), 0);
  });

  test("the creator holds nothing after the clawback", () => {
    assert.equal(book.balance("commission_held", CREATOR), 0);
  });

  test("commission returns to revenue, leaving only the ৳84 marketplace fee", () => {
    assert.equal(book.balance("platform_revenue"), 8_400);
  });

  test("the platform absorbed the ৳60 delivery leg", () => {
    assert.equal(book.balance("refund_expense"), 6_000);
  });
});

describe("idempotency", () => {
  test("replaying an event does not double-post", () => {
    const book = new Book();
    const e = orderMoneyIn({ orderId: "o3", payablePaisa: 50_000, method: "digital" });
    assert.equal(book.post(e).posted, true);
    assert.equal(book.post(e).posted, false);
    assert.equal(book.post(e).posted, false);
    assert.equal(book.balance("escrow"), 50_000);
    assert.equal(book.entries.length, 1);
  });
});

describe("regression: balances never read as negative zero", () => {
  test("a drained credit account reads 0, not -0", () => {
    const book = new Book();
    book.post(orderMoneyIn({ orderId: "z1", payablePaisa: 1_000, method: "digital" }));
    book.post(releaseEscrow({
      orderId: "z1", sellerId: SELLER, goodsPaisa: 1_000, deliveryPaisa: 0,
      commissionBp: 0, courierId: COURIER,
    }).entry);
    const bal = book.balance("escrow");
    assert.equal(bal, 0);
    // Object.is distinguishes -0 from 0; a statement must never print "-0".
    assert.ok(Object.is(bal, 0), `escrow balance was ${bal}`);
    assert.ok(Object.is(book.drift(), 0));
    assert.equal(String(bal), "0");
  });
});

describe("property: any sequence of orders leaves the book balanced", () => {
  test("1000 randomised order lifecycles never drift", () => {
    const book = new Book();
    let seed = 42;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let i = 0; i < 1000; i++) {
      const goods = (rnd(500) + 1) * 100;
      const delivery = rnd(3) * 2_000;
      const commissionBp = [250, 300, 600, 700, 900][rnd(5)];
      const payable = goods + delivery;
      book.post(orderMoneyIn({ orderId: `r${i}`, payablePaisa: payable, method: rnd(2) ? "cod" : "digital" }));

      if (rnd(4) === 0) {
        book.post(absorbRtoCost({ orderId: `r${i}`, courierId: COURIER, costPaisa: 6_000 }));
        continue;
      }
      book.post(releaseEscrow({
        orderId: `r${i}`, sellerId: SELLER, goodsPaisa: goods, deliveryPaisa: delivery,
        commissionBp, courierId: COURIER,
      }).entry);

      const rateBp = [0, 200, 300, 400][rnd(4)];
      if (rateBp > 0) {
        try {
          const a = accrueCommission({
            orderId: `r${i}`, orderItemId: `ri${i}`, creatorId: CREATOR,
            goodsPaisa: goods, rateBp, deliveredAt: DELIVERED,
          });
          book.post(a.entry);
          if (rnd(3) === 0) {
            book.post(clawBackCommission({
              orderItemId: `ri${i}`, creatorId: CREATOR, commissionPaisa: a.commissionPaisa,
              withholdingPaisa: a.withholdingPaisa, reason: "return",
            }));
          } else {
            book.post(clearCommission({ orderItemId: `ri${i}`, creatorId: CREATOR, netPaisa: a.netPaisa }));
          }
        } catch { /* commission rounded to zero; correctly refused */ }
      }
      assert.equal(book.drift(), 0, `drifted at order ${i}`);
    }
    assert.equal(book.drift(), 0);
    assert.ok(book.entries.length > 1_500, `expected a busy book, got ${book.entries.length} entries`);
  });
});
