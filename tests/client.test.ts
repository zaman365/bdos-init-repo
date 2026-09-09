import { test } from "node:test";
import assert from "node:assert/strict";
import { commandSender } from "../lib/client-command";
import { readBody } from "../lib/http";
test("lost command responses retry the same key and successful next actions use a new key", async () => {
  const keys: string[] = [];
  const send = commandSender(async (body: any) => {
    keys.push(body.key);
    if (keys.length === 1)
      throw new TypeError("Network disconnected after commit");
    return { ok: true };
  });
  await send("user", "topup", { amount: 1000 });
  await send("user", "topup", { amount: 1000 });
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
});
test("uncertain manual retries reuse receipts, while definitive errors release them", async () => {
  const keys: string[] = [];
  let fail = true;
  const send = commandSender(async (body: any) => {
    keys.push(body.key);
    if (fail) throw new TypeError("Offline");
    return { ok: true };
  });
  await assert.rejects(send("user", "post", { caption: "test" }), /Offline/);
  fail = false;
  await send("user", "post", { caption: "test" });
  assert.equal(new Set(keys).size, 1);
  const rejected: string[] = [];
  const denied = commandSender(async (body: any) => {
    rejected.push(body.key);
    throw Object.assign(new Error("Denied"), { status: 403 });
  });
  await assert.rejects(denied("user", "post", {}), /Denied/);
  await assert.rejects(denied("user", "post", {}), /Denied/);
  assert.notEqual(rejected[0], rejected[1]);
});
test("concurrent duplicate gestures share one in-flight request", async () => {
  let calls = 0;
  const send = commandSender(async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 25));
    return { ok: true };
  });
  await Promise.all([
    send("user", "gift", { id: "room" }),
    send("user", "gift", { id: "room" }),
  ]);
  assert.equal(calls, 1);
});
test("JSON byte limits stop chunked streams before reading the full request", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('"বাংলা"'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("http://test", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readBody(request, 10), /Request too large/);
  assert.equal(cancelled, true);
  assert.equal(
    await readBody(
      new Request("http://test", { method: "POST", body: '{"ok":true}' }),
    ),
    '{"ok":true}',
  );
});
