import { type DB, rows } from "./db";
import type { User } from "./auth";
// Resolve the affected entities, then acquire advisory locks in lexical order.
// Independent viewers/posts transact concurrently; shared money owners serialize.
export async function lockCommand(
  db: DB,
  u: User,
  action: string,
  data: Record<string, unknown>,
) {
  const keys = new Set([`party:${u.id}`]);
  const id =
    typeof data.id === "string" && /^[0-9a-f-]{36}$/i.test(data.id)
      ? data.id
      : null;
  if (id) keys.add(`entity:${id}`);
  for (const key of [
    "postId",
    "productId",
    "skuId",
    "recipientId",
    "creatorId",
  ])
    if (typeof data[key] === "string") keys.add(`entity:${data[key]}`);
  const party = (records: Record<string, unknown>[]) => {
    for (const r of records)
      for (const value of Object.values(r))
        if (typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value))
          keys.add(`party:${value}`);
  };
  if (id && action === "admin-moderate") {
    const cases = await rows(
      db,
      "SELECT post_id,subject_id FROM trust.moderation_case WHERE id=$1",
      [id],
    );
    for (const c of cases) {
      if (c.post_id) keys.add(`entity:${c.post_id}`);
      if (c.subject_id) keys.add(`party:${c.subject_id}`);
    }
  }
  if (id) {
    if (action === "order")
      party(
        await rows(
          db,
          `SELECT o.buyer_id,s.owner_id,at.creator_id FROM commerce.customer_order o JOIN identity.seller s ON s.id=o.seller_id LEFT JOIN commerce.order_item i ON i.order_id=o.id LEFT JOIN affiliate.attribution at ON at.order_item_id=i.id WHERE o.id=$1`,
          [id],
        ),
      );
    if (["gift", "signal", "live-chat", "live-end"].includes(action))
      party(
        await rows(db, "SELECT host_id FROM live.session WHERE id=$1", [id]),
      );
    if (action === "ad-event")
      party(
        await rows(
          db,
          "SELECT a.owner_id,p.author_id FROM ads.campaign c JOIN ads.advertiser a ON a.id=c.advertiser_id JOIN ads.creative cr ON cr.campaign_id=c.id JOIN content.post p ON p.id=cr.post_id WHERE c.id=$1",
          [id],
        ),
      );
    if (["comment", "like", "watch", "report"].includes(action))
      party(
        await rows(db, "SELECT author_id FROM content.post WHERE id=$1", [id]),
      );
    if (["message", "follow", "unblock"].includes(action))
      keys.add(`party:${id}`);
  }
  if (action === "checkout")
    party(
      await rows(
        db,
        "SELECT se.owner_id FROM commerce.cart ca JOIN commerce.sku sk ON sk.id=ca.sku_id JOIN commerce.product p ON p.id=sk.product_id JOIN identity.seller se ON se.id=p.seller_id WHERE ca.user_id=$1",
        [u.id],
      ),
    );
  if (["withdraw", "admin-clear"].includes(action)) {
    // A withdrawal clears only its own creator's accruals, so it must lock only
    // those orders. The admin sweep is deliberately unscoped. Keeping these two
    // in step with clearDue() in lib/creator.ts is the whole point: a lock scope
    // wider than the work serialises the platform, narrower and money races.
    const mine = action === "withdraw" ? u.id : null;
    const due = await rows(
      db,
      "SELECT o.id order_id,o.buyer_id,s.owner_id,a.creator_id FROM commerce.customer_order o JOIN identity.seller s ON s.id=o.seller_id LEFT JOIN commerce.order_item i ON i.order_id=o.id LEFT JOIN ledger.commission_accrual a ON a.order_item_id=i.id WHERE o.state='delivered' AND o.return_window_ends<=now() AND ($1::uuid IS NULL OR a.creator_id=$1) ORDER BY o.id",
      [mine],
    );
    for (const r of due) {
      keys.add(`entity:${r.order_id}`);
      delete r.order_id;
    }
    party(due);
  }
  // Every action whose lock scope has been reasoned about explicitly. An action
  // missing from this list gets a whole-platform lock instead: correct but slow,
  // which surfaces as latency rather than as a silent money race. Add the action
  // and its scope above, then add it here.
  const SCOPED = new Set([
    "post", "draft", "publish", "remix", "comment", "like", "watch", "report",
    "follow", "unblock", "block", "message", "profile", "nirapod", "language",
    "cart", "checkout", "order", "return", "refund", "voucher", "product",
    "sku", "seller", "showcase", "sample", "plan", "attribute",
    "gift", "signal", "live-chat", "live-start", "live-end", "coins",
    "withdraw", "payout-method", "kyc", "academy",
    "campaign", "creative", "ad-event", "ad-consent",
    "admin-moderate", "admin-clear", "admin-seller", "admin-flag", "admin-appeal",
  ]);
  if (!SCOPED.has(action)) {
    keys.add("platform:all");
  }

  for (const key of [...keys].sort())
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      key,
    ]);
}

/** Exported for tests: the actions whose lock scope is explicitly reasoned about. */
export const SCOPED_ACTIONS: readonly string[] = [
  "post", "draft", "publish", "remix", "comment", "like", "watch", "report",
  "follow", "unblock", "block", "message", "profile", "nirapod", "language",
  "cart", "checkout", "order", "return", "refund", "voucher", "product",
  "sku", "seller", "showcase", "sample", "plan", "attribute",
  "gift", "signal", "live-chat", "live-start", "live-end", "coins",
  "withdraw", "payout-method", "kyc", "academy",
  "campaign", "creative", "ad-event", "ad-consent",
  "admin-moderate", "admin-clear", "admin-seller", "admin-flag", "admin-appeal",
];
