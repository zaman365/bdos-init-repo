import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  taka, splitBp, shareBp, allocate, vat, withhold,
  formatTaka, toBengaliDigits, assertPaisa, MoneyError,
} from "../src/index.ts";

describe("paisa integrity", () => {
  test("converts taka to paisa", () => {
    assert.equal(taka(1400), 140_000);
    assert.equal(taka(14.5), 1450);
    assert.equal(taka(0.01), 1);
  });

  test("refuses fractions of a paisa", () => {
    assert.throws(() => taka(1.005), MoneyError);
  });

  test("refuses non-integer paisa", () => {
    assert.throws(() => assertPaisa(10.5), MoneyError);
  });
});

describe("splitBp — the exactness invariant", () => {
  test("a split always reassembles into the whole", () => {
    const [share, rest] = splitBp(140_000, 600);
    assert.equal(share, 8_400);
    assert.equal(share + rest, 140_000);
  });

  test("holds for every amount and rate, including awkward ones", () => {
    for (let total = 0; total <= 3_000; total++) {
      for (const bp of [0, 1, 333, 600, 2_500, 6_000, 9_999, 10_000]) {
        const [a, b] = splitBp(total, bp);
        assert.equal(a + b, total, `${total} @ ${bp}bp lost a paisa`);
        assert.ok(a >= 0 && b >= 0);
        assert.ok(Number.isInteger(a) && Number.isInteger(b));
      }
    }
  });

  test("floors the bp share so we never over-promise", () => {
    // 1 paisa at 60% is 0.6 -> the creator gets 0, not 1.
    assert.equal(shareBp(1, 6_000), 0);
    assert.equal(shareBp(3, 6_000), 1); // 1.8 -> 1
  });

  test("the 60/40 gift split on every catalogue price", () => {
    const prices = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 2_000_000];
    for (const p of prices) {
      const [creator, platform] = splitBp(p, 6_000);
      assert.equal(creator + platform, p);
      assert.equal(creator, (p * 6) / 10); // exact at these prices
    }
  });

  test("stays exact at magnitudes where float multiplication would drift", () => {
    // splitBp multiplies in BigInt, so total*bp never loses low-order bits.
    // These cases all exceed 2^53 once multiplied and must still be exact.
    const cases: [number, number][] = [
      [Number.MAX_SAFE_INTEGER, 10_000],
      [900_719_925_474_099, 3_333],
      [123_456_789_012_345, 6_001],
      [999_999_999_999_999, 7_777],
    ];
    for (const [total, bp] of cases) {
      const [a, b] = splitBp(total, bp);
      const exact = Number((BigInt(total) * BigInt(bp)) / 10_000n);
      assert.equal(a, exact, `share drifted for ${total} @ ${bp}bp`);
      assert.equal(a + b, total, `exactness broke for ${total} @ ${bp}bp`);
    }
  });

  test("rejects nonsense rates", () => {
    assert.throws(() => splitBp(100, 10_001), MoneyError);
    assert.throws(() => splitBp(100, -1), MoneyError);
  });
});

describe("allocate — nothing is ever lost", () => {
  test("distributes without losing a paisa", () => {
    assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
    assert.equal(allocate(100, [1, 1, 1]).reduce((a, b) => a + b), 100);
  });

  test("survives ugly weightings", () => {
    for (const total of [0, 1, 7, 99, 100_001]) {
      for (const w of [[1], [1, 2], [3, 3, 3, 1], [1, 0, 0], [5, 5, 5, 5, 5, 5, 5]]) {
        const parts = allocate(total, w);
        assert.equal(parts.reduce((a, b) => a + b, 0), total);
        assert.ok(parts.every(Number.isInteger));
      }
    }
  });

  test("a zero weight receives nothing", () => {
    assert.deepEqual(allocate(10, [1, 0]), [10, 0]);
  });
});

describe("tax", () => {
  test("5% VAT on commission, rounded half-up", () => {
    assert.equal(vat(8_400), 420);
    assert.equal(vat(1), 0);   // 0.05 -> 0
    assert.equal(vat(10), 1);  // 0.5  -> 1
  });

  test("withholding never exceeds the gross", () => {
    assert.equal(withhold(8_400, 1_000), 840);
    assert.equal(withhold(5, 10_000), 5);
  });
});

describe("display", () => {
  test("formats with the taka sign and fixed decimals", () => {
    assert.equal(formatTaka(140_000, "en"), "৳1,400.00");
    assert.equal(formatTaka(42_050, "en"), "৳420.50");
    assert.equal(formatTaka(5, "en"), "৳0.05");
    assert.equal(formatTaka(-8_400, "en"), "-৳84.00");
  });

  test("switches to Bengali numerals for bn", () => {
    assert.equal(toBengaliDigits("1400"), "১৪০০");
    assert.equal(formatTaka(140_000, "bn"), "৳১,৪০০.০০");
  });
});
