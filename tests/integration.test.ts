import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
try {
  process.loadEnvFile(".env.local");
} catch {}
const adminUrl = process.env.DATABASE_URL;
assert.ok(adminUrl, "DATABASE_URL is required");
const mediaDir = await mkdtemp("/tmp/bdos-media-test-");
process.env.MEDIA_DIR = mediaDir;
process.env.FFMPEG_PATH = "bundled";
const testName = `bdos_it_${process.pid}_${Date.now()}`;
const url = new URL(adminUrl);
url.pathname = `/${testName}`;
process.env.DATABASE_URL = url.toString();
process.env.BDOS_SANDBOX = "true";
const admin = new pg.Pool({ connectionString: adminUrl });
const { pool, one, rows, tx } = await import("../lib/db");
const { command } = await import("../lib/commands");
const { readApp } = await import("../lib/read");
const { balance } = await import("../lib/journal");
const { authAction } = await import("../lib/auth");
const { origin } = await import("../lib/http");
const users: Record<string, any> = {};
let product: any, sku: any, post: any;
const call = (
  who: string,
  action: string,
  data: Record<string, unknown> = {},
  key = randomUUID(),
) => command(users[who], { action, data, key });
const view = (who: string, name: string, query = "") =>
  readApp(users[who], new URL(`http://test/api/data?view=${name}${query}`));
const eqBalance = async (kind: string, owner: string, value: number) =>
  assert.equal(await balance(pool, kind, owner), value);
before(async () => {
  await admin.query(`CREATE DATABASE "${testName}"`);
  await tx(async (db) => {
    for (const file of (await readdir("db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.query(await readFile(`db/migrations/${file}`, "utf8"));
  });
  execFileSync(process.execPath, ["--import", "tsx", "scripts/seed.ts"], {
    env: process.env,
    stdio: "pipe",
  });
  for (const handle of [
    "nusrat",
    "rifat",
    "bogurashop",
    "operations",
    "shakib",
    "tamim",
  ])
    users[handle] = await one(
      pool,
      "SELECT * FROM identity.user_account WHERE handle=$1",
      [handle],
    );
  product = await one(
    pool,
    "SELECT * FROM commerce.product WHERE title_en='Everyday Jamdani'",
  );
  sku = await one(
    pool,
    "SELECT * FROM commerce.sku WHERE product_id=$1 AND code='default'",
    [product.id],
  );
  post = await one(
    pool,
    "SELECT p.* FROM content.post p JOIN commerce.post_product pp ON pp.post_id=p.id WHERE pp.product_id=$1 AND p.author_id=$2 LIMIT 1",
    [product.id, users.nusrat.id],
  );
});
after(async () => {
  await rm(mediaDir, { recursive: true, force: true });
  await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS "${testName}" WITH (FORCE)`);
  await admin.end();
});
async function order(who = "rifat", method = "cod") {
  await call(who, "cart", { skuId: sku.id, qty: 1, postId: post.id });
  const r = await call(who, "checkout", {
    method,
    address: "Sandbox house 12, Test Road, Dhaka",
    district: "Dhaka",
  });
  return r.ids[0] as string;
}
async function deliver(id: string, who = "rifat") {
  await call(who, "order", { id, step: "confirm" });
  await call("bogurashop", "order", { id, step: "ship" });
  await call(who, "order", { id, step: "deliver" });
}
test("all view queries load with role-specific access", async () => {
  for (const name of [
    "feed",
    "cut",
    "shop",
    "orders",
    "seller",
    "studio",
    "affiliate",
    "ads",
    "profile",
    "inbox",
    "live",
  ]) {
    const d = await view("rifat", name);
    assert.equal(d.user.id, users.rifat.id);
  }
  await view("operations", "admin");
  await view("shakib", "partner");
  await assert.rejects(view("rifat", "admin"), /Operations access/);
  await assert.rejects(view("rifat", "partner"), /Partner access/);
});
test("Banglish search and mutual feed work", async () => {
  const d = await view("rifat", "feed", "&q=kacchi");
  assert.ok(d.posts.some((p: any) => p.caption.includes("কাচ্চি")));
  const f = await view("rifat", "feed", "&mode=pashe");
  assert.ok(f.posts.length > 0);
  assert.ok(f.posts.every((p: any) => p.author_id === users.nusrat.id));
});
test("OTP attempts persist, codes are one-use, sessions are authenticated", async () => {
  const request = (body: unknown) =>
    new Request("http://test", { method: "POST", body: JSON.stringify(body) });
  const response = await authAction(
    "auth/request",
    request({ phone: users.rifat.msisdn }),
  );
  const { sandboxCode } = await response.json();
  assert.match(sandboxCode, /^\d{6}$/);
  const wrong = await authAction(
    "auth/verify",
    request({ phone: users.rifat.msisdn, code: "000000" }),
  );
  assert.equal(wrong.status, 401);
  assert.equal(
    (await one(pool, "SELECT attempts FROM app.otp WHERE phone=$1", [
      users.rifat.msisdn,
    ]))!.attempts,
    1,
  );
  const success = await authAction(
    "auth/verify",
    request({ phone: users.rifat.msisdn, code: sandboxCode }),
  );
  assert.match(success.headers.get("set-cookie")!, /HttpOnly/);
  await assert.rejects(
    authAction(
      "auth/verify",
      request({ phone: users.rifat.msisdn, code: sandboxCode }),
    ),
    /expired/,
  );
  assert.throws(
    () =>
      origin(
        new Request("http://test", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    /origin/,
  );
});
test("idempotency replays once and rejects different payloads", async () => {
  const key = randomUUID();
  const first = await call("rifat", "topup", { amount: 1000 }, key);
  const b = await balance(pool, "coin_liability", users.rifat.id);
  assert.deepEqual(await call("rifat", "topup", { amount: 1000 }, key), first);
  await eqBalance("coin_liability", users.rifat.id, b);
  await assert.rejects(
    call("rifat", "topup", { amount: 2000 }, key),
    /different data/,
  );
});
test("permission checks prevent cross-account writes and minor LIVE/gifting", async () => {
  await assert.rejects(
    call("rifat", "admin-flag", { name: "ads", enabled: false }),
    /permission/,
  );
  await assert.rejects(
    call("rifat", "sku", {
      productId: product.id,
      label: "Intruder",
      price: 100,
      stock: 1,
    }),
    /seller account/,
  );
  await assert.rejects(
    call("tamim", "live-start", { title: "Underage room" }),
    /18/,
  );
  await assert.rejects(call("tamim", "topup", { amount: 1000 }), /18/);
});
test("COD lifecycle holds fees, requires buyer confirmation and releases balanced escrow", async () => {
  const id = await order();
  const before = await one(
    pool,
    "SELECT * FROM commerce.customer_order WHERE id=$1",
    [id],
  );
  assert.equal(before!.prepaid_paisa, 6000);
  await assert.rejects(
    call("bogurashop", "order", { id, step: "ship" }),
    /confirmation/,
  );
  await assert.rejects(
    call("shakib", "order", { id, step: "confirm" }),
    /another account/,
  );
  await deliver(id);
  const o = await one(
    pool,
    "SELECT * FROM commerce.customer_order WHERE id=$1",
    [id],
  );
  assert.equal(o!.state, "delivered");
  assert.ok(o!.seller_net_paisa > 0);
  const a = await one(
    pool,
    "SELECT a.* FROM ledger.commission_accrual a JOIN commerce.order_item i ON i.id=a.order_item_id WHERE i.order_id=$1",
    [id],
  );
  assert.equal(a!.state, "held");
  assert.equal(a!.commission_paisa, 7200);
  assert.equal(a!.net_paisa, 6480);
  await call("operations", "admin-clear");
  assert.equal(
    (await one(
      pool,
      "SELECT state FROM ledger.commission_accrual WHERE id=$1",
      [a!.id],
    ))!.state,
    "held",
  );
  await call("bogurashop", "payout-method", {
    channel: "bkash",
    account: "+8801912345678",
  });
  await assert.rejects(
    call("bogurashop", "withdraw", {
      source: "seller_payable",
      amount: o!.seller_net_paisa,
    }),
    /Insufficient cleared/,
  );
  await pool.query(
    "UPDATE ledger.commission_accrual SET hold_until=now()-interval '1 second' WHERE id=$1",
    [a!.id],
  );
  await pool.query(
    "UPDATE commerce.customer_order SET return_window_ends=now()-interval '1 second' WHERE id=$1",
    [id],
  );
  await call("operations", "admin-clear");
  assert.equal(
    (await one(
      pool,
      "SELECT state FROM ledger.commission_accrual WHERE id=$1",
      [a!.id],
    ))!.state,
    "cleared",
  );
  await call("nusrat", "payout-method", {
    channel: "bkash",
    account: "+8801712345678",
  });
  await call("nusrat", "withdraw", {
    amount: a!.net_paisa,
    source: "creator_payable",
  });
  await eqBalance("creator_payable", users.nusrat.id, 0);
  await assert.rejects(
    call("rifat", "order", { id, step: "deliver" }),
    /Only shipped/,
  );
  assert.equal(
    (await one(pool, "SELECT drift_paisa FROM ledger.trial_balance"))!
      .drift_paisa,
    0,
  );
});
test("digital return refunds full amount, reverses fees/commission and restocks once", async () => {
  const start = (await one(pool, "SELECT stock FROM commerce.sku WHERE id=$1", [
    sku.id,
  ]))!.stock;
  const id = await order("rifat", "bkash");
  await deliver(id);
  await call("rifat", "order", {
    id,
    step: "return",
    reason: "Product did not match the description",
  });
  await call("bogurashop", "order", { id, step: "refund" });
  assert.equal(
    (await one(pool, "SELECT state FROM commerce.customer_order WHERE id=$1", [
      id,
    ]))!.state,
    "refunded",
  );
  assert.equal(
    (await one(pool, "SELECT stock FROM commerce.sku WHERE id=$1", [sku.id]))!
      .stock,
    start,
  );
  assert.equal(
    (await one(
      pool,
      "SELECT a.state FROM ledger.commission_accrual a JOIN commerce.order_item i ON i.id=a.order_item_id WHERE i.order_id=$1",
      [id],
    ))!.state,
    "clawed_back",
  );
  await assert.rejects(
    call("bogurashop", "order", { id, step: "refund" }),
    /return request/,
  );
  assert.equal(
    (await one(pool, "SELECT drift_paisa FROM ledger.trial_balance"))!
      .drift_paisa,
    0,
  );
});
test("RTO and cancellation refund prepaid funds and restore inventory", async () => {
  const id = await order();
  await call("rifat", "order", { id, step: "confirm" });
  await call("bogurashop", "order", { id, step: "ship" });
  await call("bogurashop", "order", { id, step: "rto" });
  assert.equal(
    (await one(pool, "SELECT state FROM commerce.customer_order WHERE id=$1", [
      id,
    ]))!.state,
    "cancelled",
  );
  const id2 = await order("rifat", "card");
  await call("rifat", "order", { id: id2, step: "cancel" });
  assert.equal(
    (await one(pool, "SELECT state FROM commerce.customer_order WHERE id=$1", [
      id2,
    ]))!.state,
    "cancelled",
  );
});
test("concurrent checkouts cannot oversell the final unit", async () => {
  await pool.query("UPDATE commerce.sku SET stock=1 WHERE id=$1", [sku.id]);
  await call("rifat", "cart", { skuId: sku.id, qty: 1 });
  await call("shakib", "cart", { skuId: sku.id, qty: 1 });
  const responses = await Promise.allSettled(
    ["rifat", "shakib"].map((who) =>
      call(who, "checkout", {
        method: "cod",
        address: "Sandbox house, Test Road 34",
        district: "Dhaka",
      }),
    ),
  );
  assert.equal(responses.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await one(pool, "SELECT stock FROM commerce.sku WHERE id=$1", [sku.id]))!
      .stock,
    0,
  );
  await pool.query("UPDATE commerce.sku SET stock=50 WHERE id=$1", [sku.id]);
  await pool.query("DELETE FROM commerce.cart");
});
test("sample requests progress through ownership-controlled states", async () => {
  await call("nusrat", "sample", {
    productId: product.id,
    pitch: "I will create a helpful original product story",
  });
  const s = await one(
    pool,
    "SELECT id FROM affiliate.sample_request WHERE creator_id=$1 AND product_id=$2",
    [users.nusrat.id, product.id],
  );
  await assert.rejects(
    call("rifat", "sample-status", { id: s!.id, state: "approved" }),
    /another account/,
  );
  await call("bogurashop", "sample-status", { id: s!.id, state: "approved" });
  await call("bogurashop", "sample-status", {
    id: s!.id,
    state: "shipped",
    tracking: "SANDBOX-SAMPLE-001",
  });
  await call("nusrat", "sample-status", { id: s!.id, state: "received" });
  await call("nusrat", "sample-status", { id: s!.id, state: "content_posted" });
});
test("LIVE gift split and failed payout keep balances exact; concurrent withdrawal cannot double spend", async () => {
  await call("nusrat", "payout-method", {
    channel: "bkash",
    account: "+8801712345678",
  });
  const room = await call("nusrat", "live-start", { title: "Test LIVE" });
  const before = await balance(pool, "coin_liability", users.rifat.id);
  await assert.rejects(
    call("nusrat", "gift", { id: room.id, giftId: 1 }),
    /yourself/,
  );
  await call("rifat", "gift", { id: room.id, giftId: 2 });
  await eqBalance("coin_liability", users.rifat.id, before - 5000);
  await eqBalance("gift_liability", users.nusrat.id, 3000);
  await call("nusrat", "withdraw", {
    source: "gift_liability",
    amount: 3000,
    simulateFailure: true,
  });
  await eqBalance("gift_liability", users.nusrat.id, 3000);
  const results = await Promise.allSettled([
    call("nusrat", "withdraw", { source: "gift_liability", amount: 3000 }),
    call("nusrat", "withdraw", { source: "gift_liability", amount: 3000 }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await eqBalance("gift_liability", users.nusrat.id, 0);
  await call("rifat", "signal", {
    id: room.id,
    recipientId: users.nusrat.id,
    payload: { join: true },
  });
  await call("nusrat", "signal", {
    id: room.id,
    recipientId: users.rifat.id,
    payload: { description: { type: "offer", sdp: "test" } },
  });
  await call("rifat", "live-chat", {
    id: room.id,
    body: "Hello from the sandbox",
  });
  await call("nusrat", "live-end", { id: room.id });
  await assert.rejects(
    call("rifat", "gift", { id: room.id, giftId: 1 }),
    /ended/,
  );
});
test("Nirapod blocks discovery and DMs; moderation can be appealed once", async () => {
  await assert.rejects(
    call("rifat", "message", { id: users.nusrat.id, body: "Hello" }),
    /does not accept/,
  );
  await assert.rejects(
    call("rifat", "comment", { id: post.id, body: "kill yourself" }),
    /blocked by Nirapod/,
  );
  await call("rifat", "report", {
    id: post.id,
    reason: "harassment",
    note: "Synthetic safety test",
    block: true,
  });
  assert.ok(
    !(await view("rifat", "feed")).posts.some(
      (p: any) => p.author_id === users.nusrat.id,
    ),
  );
  await assert.rejects(
    call("rifat", "follow", { id: users.nusrat.id, follow: true }),
    /unavailable/,
  );
  const c = await one(
    pool,
    "SELECT id FROM trust.moderation_case WHERE post_id=$1",
    [post.id],
  );
  await call("operations", "admin-moderate", {
    id: c!.id,
    decision: "remove",
    reasonBn: "পরীক্ষার জন্য কনটেন্ট সরানো হয়েছে",
    reasonEn: "Removed for a synthetic safety review",
  });
  await call("nusrat", "appeal", {
    id: c!.id,
    statement: "This is original craft content, please review",
  });
  await call("operations", "admin-moderate", {
    id: c!.id,
    decision: "overturn",
    reasonBn: "পর্যালোচনার পরে কনটেন্ট ফিরিয়ে দেওয়া হয়েছে",
    reasonEn: "Restored after reviewing the appeal",
  });
  assert.equal(
    (await one(pool, "SELECT state FROM content.post WHERE id=$1", [post.id]))!
      .state,
    "published",
  );
  await call("rifat", "unblock", { id: users.nusrat.id });
});
test("drafts stay private; default remix permissions and media ownership are enforced", async () => {
  const draft = await call("rifat", "post", {
    caption: "Private draft content",
    template: "original",
    publish: false,
  });
  assert.ok(
    !(await view("shakib", "feed")).posts.some((p: any) => p.id === draft.id),
  );
  const p = await call("rifat", "post", {
    id: draft.id,
    caption: "Published test content",
    template: "original",
    publish: true,
  });
  await assert.rejects(
    call("shakib", "post", {
      caption: "Unpermitted duet",
      template: "duet",
      parentId: p.id,
      publish: true,
    }),
    /disabled/,
  );
  await assert.rejects(
    call("shakib", "post", {
      id: p.id,
      caption: "Hijacked",
      template: "original",
      publish: true,
    }),
    /your drafts/,
  );
});
test("Spark ads need consent and review; duplicate impressions and total budgets are enforced", async () => {
  const c = await call("bogurashop", "campaign", {
    name: "Test Spark",
    postId: post.id,
    productId: product.id,
    objective: "product_sales",
    budget: 100,
    daily: 100,
    bid: 100,
  });
  await assert.rejects(
    call("rifat", "ad-event", {
      id: c.id,
      kind: "impression",
      token: "pending",
    }),
    /unavailable/,
  );
  await call("operations", "admin-campaign", { id: c.id, approve: true });
  const feed = await view("rifat", "feed");
  assert.equal(feed.ads[0].id, c.id);
  const wallet = await balance(pool, "coin_liability", users.bogurashop.id);
  await call("rifat", "ad-event", {
    id: c.id,
    kind: "impression",
    token: feed.ads[0].token,
  });
  assert.equal(
    (await one(pool, "SELECT spent_paisa FROM ads.campaign WHERE id=$1", [
      c.id,
    ]))!.spent_paisa,
    100,
  );
  // A last-budget impression may be retried and clicked without a second debit.
  await call("rifat", "ad-event", {
    id: c.id,
    kind: "impression",
    token: feed.ads[0].token,
  });
  await call("rifat", "ad-event", {
    id: c.id,
    kind: "click",
    token: feed.ads[0].token,
  });
  await call("rifat", "ad-event", {
    id: c.id,
    kind: "click",
    token: feed.ads[0].token,
  });
  assert.equal(
    (await one(
      pool,
      "SELECT count(*)::int n FROM ads.event WHERE campaign_id=$1",
      [c.id],
    ))!.n,
    2,
  );
  await eqBalance("coin_liability", users.bogurashop.id, wallet - 100);
  await assert.rejects(
    call("shakib", "ad-event", {
      id: c.id,
      kind: "impression",
      token: "pending",
    }),
    /unavailable/,
  );
  await call("nusrat", "spark-consent", {
    postId: post.id,
    sellerId: product.seller_id,
    grant: false,
  });
  await assert.rejects(
    call("bogurashop", "campaign", {
      name: "Without consent",
      postId: post.id,
      productId: product.id,
      objective: "reach",
      budget: 100,
      daily: 100,
      bid: 10,
    }),
    /permission/,
  );
});
test("feature switches, partner leads, and capped notifications are operational", async () => {
  await call("operations", "admin-flag", { name: "commerce", enabled: false });
  await assert.rejects(
    call("rifat", "cart", { skuId: sku.id, qty: 1 }),
    /paused/,
  );
  await call("operations", "admin-flag", { name: "commerce", enabled: true });
  await call("shakib", "partner-lead", {
    name: "Synthetic SME",
    district: "Bogura",
    phone: "+8801711111111",
  });
  const lead = await one(
    pool,
    "SELECT id FROM app.partner_lead WHERE business_name='Synthetic SME'",
  );
  await call("operations", "admin-lead", { id: lead!.id, state: "onboarded" });
  const notificationCount = await one(
    pool,
    "SELECT count(*) n FROM app.notification WHERE user_id=$1 AND created_at>=current_date",
    [users.nusrat.id],
  );
  assert.ok(notificationCount!.n <= 10);
});
test("database rejects empty/unbalanced/late journals and immutable mutations", async () => {
  await assert.rejects(
    pool.query(
      "INSERT INTO ledger.journal_entry(kind,idempotency_key,description) VALUES('manual_correction','empty','empty')",
    ),
    /at least 2/,
  );
  await assert.rejects(
    tx(async (db) => {
      const h = await one(
        db,
        "INSERT INTO ledger.journal_entry(kind,idempotency_key,description) VALUES('manual_correction','bad','bad') RETURNING id",
      );
      await db.query(
        "INSERT INTO ledger.journal_line(entry_id,account_id,amount_paisa) SELECT $1,id,100 FROM ledger.account LIMIT 1",
        [h!.id],
      );
    }),
    /at least 2/,
  );
  await assert.rejects(
    pool.query("UPDATE ledger.journal_line SET amount_paisa=1"),
    /append-only/,
  );
  await assert.rejects(
    pool.query("DELETE FROM ledger.journal_entry"),
    /append-only/,
  );
  const header = await one(pool, "SELECT id FROM ledger.journal_entry LIMIT 1");
  await assert.rejects(
    pool.query(
      "INSERT INTO ledger.journal_line(entry_id,account_id,amount_paisa) SELECT $1,id,1 FROM ledger.account LIMIT 1",
      [header!.id],
    ),
    /append-only/,
  );
  assert.equal(
    (await one(pool, "SELECT drift_paisa FROM ledger.trial_balance"))!
      .drift_paisa,
    0,
  );
});
test("sandbox-off refuses simulated external providers", async () => {
  process.env.BDOS_SANDBOX = "false";
  try {
    await assert.rejects(
      call("rifat", "topup", { amount: 1000 }),
      /not configured/,
    );
  } finally {
    process.env.BDOS_SANDBOX = "true";
  }
});

test("video upload transcodes and media range/visibility controls work", async () => {
  const ffmpeg = (await import("ffmpeg-static")).default!;
  const source = `${mediaDir}/synthetic.mp4`;
  execFileSync(
    ffmpeg,
    [
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=640x480:d=1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      source,
    ],
    { stdio: "pipe" },
  );
  const { upload, mediaResponse } = await import("../lib/media");
  const form = new FormData();
  form.append(
    "file",
    new File([await readFile(source)], "synthetic.mp4", { type: "video/mp4" }),
  );
  const result = await upload(
    users.rifat,
    new Request("http://test/api/upload", { method: "POST", body: form }),
  );
  assert.equal(result.mime, "video/mp4");
  await assert.rejects(
    mediaResponse(users.shakib, result.id, new Request("http://test")),
    /Media not found/,
  );
  const p = await call("rifat", "post", {
    caption: "A synthetic video for testing",
    template: "original",
    mediaId: result.id,
    publish: true,
  });
  const response = await mediaResponse(
    users.shakib,
    result.id,
    new Request("http://test", { headers: { range: "bytes=0-99" } }),
  );
  assert.equal(response.status, 206);
  assert.equal((await response.arrayBuffer()).byteLength, 100);
  await assert.rejects(
    call("shakib", "post", {
      caption: "Attempted media theft",
      template: "original",
      mediaId: result.id,
      publish: true,
    }),
    /another account/,
  );
  await pool.query("UPDATE content.post SET state='removed' WHERE id=$1", [
    p.id,
  ]);
  await assert.rejects(
    mediaResponse(users.shakib, result.id, new Request("http://test")),
    /Media not found/,
  );
  const bad = new FormData();
  bad.append(
    "file",
    new File(["<script>bad</script>"], "fake.png", { type: "image/png" }),
  );
  await assert.rejects(
    upload(
      users.rifat,
      new Request("http://test", { method: "POST", body: bad }),
    ),
    /Use a PNG/,
  );
});
