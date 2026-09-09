import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rank, searchTerms, aliases, type Candidate } from "../src/index.ts";

const HOUR = 3_600_000;
const now = Date.parse("2026-09-09T12:00:00Z");

/** A candidate with sane defaults, so each test states only what it cares about. */
function post(over: Partial<Candidate> & { id: string }): Candidate {
  return {
    author_id: `author-${over.id}`,
    plays: 100, completions: 50, likes: 10, reports: 0,
    served_impressions: 1_000, guaranteed_impressions: 500,
    published_at: new Date(now - 30 * 24 * HOUR).toISOString(),
    ...over,
  };
}

describe("the audition guarantee", () => {
  test("a post inside its guaranteed impressions outranks a stronger established post", () => {
    // docs/03 §4 calls cold start a contract, not a heuristic: a brand-new
    // post must get its audition even against better-performing content.
    const fresh = post({
      id: "new", plays: 0, completions: 0, likes: 0,
      served_impressions: 0, guaranteed_impressions: 500,
      published_at: new Date(now - HOUR).toISOString(),
    });
    const strong = post({
      id: "hit", plays: 10_000, completions: 9_000, likes: 5_000,
      served_impressions: 50_000, guaranteed_impressions: 500,
    });
    const out = rank([strong, fresh], now);
    assert.equal(out[0].id, "new", "the audition was not honoured");
  });

  test("once the audition is served, the boost stops applying", () => {
    const served = post({
      id: "served", plays: 0, completions: 0, likes: 0,
      served_impressions: 500, guaranteed_impressions: 500,
      published_at: new Date(now - HOUR).toISOString(),
    });
    const strong = post({
      id: "hit", plays: 10_000, completions: 9_000, likes: 5_000,
    });
    const out = rank([strong, served], now);
    assert.equal(out[0].id, "hit", "a fully-auditioned post kept its boost");
  });
});

describe("what ranking rewards", () => {
  test("completion rate beats raw play count", () => {
    // Paying on retention rather than impressions is the whole point of the
    // Sonar Fund design (docs/01 §4.2) — ranking must agree with it.
    const grabby = post({ id: "grabby", plays: 10_000, completions: 500, likes: 0 });
    const held = post({ id: "held", plays: 500, completions: 450, likes: 0 });
    const out = rank([grabby, held], now);
    assert.equal(out[0].id, "held");
  });

  test("reports push a post down", () => {
    const clean = post({ id: "clean", reports: 0 });
    const reported = post({ id: "reported", reports: 200 });
    const out = rank([reported, clean], now);
    assert.equal(out[0].id, "clean");
  });

  test("recency lifts a post, and the lift decays", () => {
    const justNow = post({ id: "now", published_at: new Date(now - HOUR).toISOString() });
    const lastWeek = post({ id: "old", published_at: new Date(now - 7 * 24 * HOUR).toISOString() });
    const out = rank([lastWeek, justNow], now);
    assert.equal(out[0].id, "now");
  });
});

describe("author diversity", () => {
  test("no author appears three times in a row when the pool allows it", () => {
    // One creator must not own the feed, however well they perform.
    const items: Candidate[] = [];
    for (let i = 0; i < 6; i++) {
      items.push(post({ id: `a${i}`, author_id: "hogger", likes: 1_000 }));
    }
    for (let i = 0; i < 6; i++) {
      items.push(post({ id: `b${i}`, author_id: `other-${i}`, likes: 1 }));
    }
    const out = rank(items, now);
    for (let i = 2; i < out.length; i++) {
      const three = [out[i - 2], out[i - 1], out[i]].map((p) => p.author_id);
      assert.notEqual(
        new Set(three).size, 1,
        `positions ${i - 2}..${i} are all ${three[0]}`,
      );
    }
  });

  test("diversity degrades gracefully rather than dropping posts", () => {
    // 12 posts from one author and 2 from others cannot be interleaved without
    // a run of three. The requirement is that nothing is lost, not that the
    // impossible is achieved.
    const items: Candidate[] = [];
    for (let i = 0; i < 12; i++) items.push(post({ id: `a${i}`, author_id: "hogger" }));
    for (let i = 0; i < 2; i++) items.push(post({ id: `b${i}`, author_id: `other-${i}` }));
    const out = rank(items, now);
    assert.equal(out.length, 14);
    assert.equal(new Set(out.map((p) => p.id)).size, 14);
  });

  test("every input is returned exactly once", () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      post({ id: `p${i}`, author_id: `a${i % 3}` }));
    const out = rank(items, now);
    assert.equal(out.length, items.length);
    assert.deepEqual(
      new Set(out.map((p) => p.id)).size, items.length,
      "ranking dropped or duplicated a post",
    );
  });
});

describe("determinism", () => {
  test("identical input yields identical order", () => {
    const items = Array.from({ length: 30 }, (_, i) => post({ id: `p${i}`, author_id: `a${i % 5}`, likes: i }));
    const a = rank([...items], now).map((p) => p.id);
    const b = rank([...items], now).map((p) => p.id);
    assert.deepEqual(a, b);
  });

  test("ties break on id, not on input order", () => {
    const x = post({ id: "aaa", author_id: "one" });
    const y = post({ id: "bbb", author_id: "two" });
    assert.deepEqual(rank([x, y], now).map((p) => p.id), rank([y, x], now).map((p) => p.id));
  });

  test("an empty feed is not an error", () => {
    assert.deepEqual(rank([], now), []);
  });
});

describe("Banglish search", () => {
  test("a Latin query also searches the Bangla spelling", () => {
    // People type "kacchi" and "কাচ্চি" for the same thing (docs/05 §5).
    const terms = searchTerms("kacchi");
    assert.ok(terms.includes("kacchi"));
    assert.ok(terms.includes("কাচ্চি"), `got ${JSON.stringify(terms)}`);
  });

  test("a Bangla query also searches the Latin spelling", () => {
    const terms = searchTerms("জামদানি");
    assert.ok(terms.includes("jamdani"), `got ${JSON.stringify(terms)}`);
  });

  test("substrings inside a longer phrase are translated too", () => {
    const terms = searchTerms("dhaka kurti");
    assert.ok(terms.some((t) => t.includes("ঢাকা")) || terms.some((t) => t.includes("কুর্তি")));
  });

  test("queries are trimmed, lowercased and length-capped", () => {
    assert.ok(searchTerms("   KACCHI  ").includes("kacchi"));
    assert.ok(searchTerms("x".repeat(500))[0].length <= 100);
  });

  test("an unknown term returns just itself", () => {
    assert.deepEqual(searchTerms("zzzz"), ["zzzz"]);
  });

  test("every alias round-trips in both directions", () => {
    for (const [latin, bangla] of Object.entries(aliases)) {
      assert.ok(searchTerms(latin).includes(bangla), `${latin} -> ${bangla}`);
      assert.ok(searchTerms(bangla).includes(latin), `${bangla} -> ${latin}`);
    }
  });
});
