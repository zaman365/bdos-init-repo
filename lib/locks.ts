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
    const due = await rows(
      db,
      "SELECT o.id order_id,o.buyer_id,s.owner_id,a.creator_id FROM commerce.customer_order o JOIN identity.seller s ON s.id=o.seller_id LEFT JOIN commerce.order_item i ON i.order_id=o.id LEFT JOIN ledger.commission_accrual a ON a.order_item_id=i.id WHERE o.state='delivered' AND o.return_window_ends<=now() ORDER BY o.id",
    );
    for (const r of due) {
      keys.add(`entity:${r.order_id}`);
      delete r.order_id;
    }
    party(due);
  }
  for (const key of [...keys].sort())
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      key,
    ]);
}
