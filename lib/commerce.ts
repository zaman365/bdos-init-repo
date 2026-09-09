import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  type DB,
  type Row,
  one,
  rows,
  need,
  flag,
  notify,
  requireSandbox,
} from "./db";
import { type User, adult, blocked } from "./auth";
import { journal, reverse } from "./journal";
import { shareBp, vat, allocate } from "../packages/money/src/index.ts";
import {
  orderMoneyIn,
  accrueCommission,
  clawBackCommission,
  absorbRtoCost,
  releaseEscrow,
} from "../packages/ledger/src/index.ts";
const uuid = z.string().uuid();
export async function sellerFor(db: DB, u: User) {
  const s = await one(
    db,
    "SELECT * FROM identity.seller WHERE owner_id=$1 AND state='active'",
    [u.id],
  );
  need(s, "An approved seller account is required", 403);
  return s;
}
export async function commerceCommand(
  db: DB,
  u: User,
  action: string,
  raw: Row,
): Promise<Row | undefined> {
  if (action === "seller-apply") {
    adult(u);
    const d = z
      .object({
        name: z.string().trim().min(2).max(100),
        dbid: z.string().trim().min(3).max(80),
      })
      .parse(raw);
    await db.query(
      `INSERT INTO identity.seller(owner_id,legal_name,trade_name,dbid,state) VALUES($1,$2,$2,$3,'pending_review') ON CONFLICT(owner_id) DO UPDATE SET legal_name=$2,trade_name=$2,dbid=$3,state='pending_review' WHERE identity.seller.state IN ('draft','pending_review')`,
      [u.id, d.name, d.dbid],
    );
    return { message: "Seller application sent for review" };
  }
  if (action === "product") {
    const s = await sellerFor(db, u);
    const d = z
      .object({
        id: uuid.optional(),
        version: z.number().int().nonnegative().optional(),
        skuVersion: z.number().int().nonnegative().optional(),
        title: z.string().trim().min(2).max(160),
        titleBn: z.string().trim().min(2).max(160),
        description: z.string().max(3000),
        category: z.number().int().min(1).max(10),
        price: z.number().int().min(100).max(100000000),
        stock: z.number().int().min(0).max(100000),
        variant: z.string().max(60),
        active: z.boolean(),
        cover: z
          .enum([
            "/art/craft.svg",
            "/art/beauty.svg",
            "/art/food.svg",
            "/art/stage.svg",
          ])
          .default("/art/craft.svg"),
      })
      .parse(raw);
    if (d.id) {
      need(
        await one(
          db,
          "SELECT 1 FROM commerce.product WHERE id=$1 AND seller_id=$2",
          [d.id, s.id],
        ),
        "Product belongs to another seller",
        403,
      );
      need(
        d.version !== undefined && d.skuVersion !== undefined,
        "Reload the product before editing",
        409,
      );
      const current = await one(
        db,
        "SELECT version FROM commerce.product WHERE id=$1 FOR UPDATE",
        [d.id],
      );
      const variant = await one(
        db,
        "SELECT version FROM commerce.sku WHERE product_id=$1 AND code='default' FOR UPDATE",
        [d.id],
      );
      need(
        current?.version === d.version && variant?.version === d.skuVersion,
        "Stock or product changed. Refresh and reopen this form.",
        409,
      );
      await db.query(
        "UPDATE commerce.product SET title_en=$2,title_bn=$3,description=$4,category_id=$5,is_active=$6,cover=$7 WHERE id=$1",
        [
          d.id,
          d.title,
          d.titleBn,
          d.description,
          d.category,
          d.active,
          d.cover,
        ],
      );
      await db.query(
        "UPDATE commerce.sku SET price_paisa=$2,stock=$3,variant_label=$4 WHERE product_id=$1 AND code='default'",
        [d.id, d.price, d.stock, d.variant],
      );
      return { id: d.id, message: "Product updated" };
    }
    const p = await one(
      db,
      "INSERT INTO commerce.product(seller_id,title_en,title_bn,description,category_id,is_active,cover) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [s.id, d.title, d.titleBn, d.description, d.category, d.active, d.cover],
    );
    await db.query(
      "INSERT INTO commerce.sku(product_id,code,variant_label,price_paisa,stock) VALUES($1,'default',$2,$3,$4)",
      [p!.id, d.variant, d.price, d.stock],
    );
    return { id: p!.id, message: "Product listed" };
  }
  if (action === "sku") {
    const s = await sellerFor(db, u);
    const d = z
      .object({
        productId: uuid,
        id: uuid.optional(),
        version: z.number().int().nonnegative().optional(),
        label: z.string().trim().min(1).max(60),
        price: z.number().int().min(100).max(100000000),
        stock: z.number().int().min(0).max(100000),
      })
      .parse(raw);
    need(
      await one(
        db,
        "SELECT 1 FROM commerce.product WHERE id=$1 AND seller_id=$2",
        [d.productId, s.id],
      ),
      "Product belongs to another seller",
      403,
    );
    if (d.id) {
      need(d.version !== undefined, "Reload the variant before editing", 409);
      const updated = await one(
        db,
        "UPDATE commerce.sku SET variant_label=$3,price_paisa=$4,stock=$5 WHERE id=$1 AND product_id=$2 AND version=$6 RETURNING id",
        [d.id, d.productId, d.label, d.price, d.stock, d.version],
      );
      need(
        updated,
        "Variant changed or is unavailable. Refresh and reopen this form.",
        409,
      );
      return { id: d.id, message: "Variant updated" };
    }
    await db.query(
      "INSERT INTO commerce.sku(product_id,code,variant_label,price_paisa,stock) VALUES($1,$2,$3,$4,$5)",
      [d.productId, randomUUID(), d.label, d.price, d.stock],
    );
    return { message: "Variant added" };
  }
  if (action === "cart") {
    const d = z
      .object({
        skuId: uuid,
        qty: z.number().int().min(0).max(99),
        postId: uuid.optional(),
      })
      .parse(raw);
    if (d.qty === 0) {
      await db.query(
        "DELETE FROM commerce.cart WHERE user_id=$1 AND sku_id=$2",
        [u.id, d.skuId],
      );
      return { message: "Item removed" };
    }
    await flag(db, "commerce");
    const p = await one(
      db,
      `SELECT s.*,p.seller_id FROM commerce.sku s JOIN commerce.product p ON p.id=s.product_id JOIN identity.seller se ON se.id=p.seller_id WHERE s.id=$1 AND p.is_active AND se.state='active'`,
      [d.skuId],
    );
    need(p, "Product unavailable");
    need(p.stock >= d.qty, "Not enough stock");
    if (d.postId) {
      const tag = await one(
        db,
        `SELECT p.author_id FROM commerce.post_product pp JOIN content.post p ON p.id=pp.post_id WHERE pp.post_id=$1 AND pp.product_id=$2 AND p.state='published'`,
        [d.postId, p.product_id],
      );
      need(tag, "Invalid product source");
      need(!(await blocked(db, u.id, tag.author_id)), "Post unavailable", 403);
      await db.query(
        "INSERT INTO affiliate.click(creator_id,product_id,post_id,viewer_id) VALUES($1,$2,$3,$4)",
        [tag.author_id, p.product_id, d.postId, u.id],
      );
    }
    if (d.qty === 0)
      await db.query(
        "DELETE FROM commerce.cart WHERE user_id=$1 AND sku_id=$2",
        [u.id, d.skuId],
      );
    else
      await db.query(
        "INSERT INTO commerce.cart(user_id,sku_id,qty,source_post_id) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,sku_id) DO UPDATE SET qty=$3,source_post_id=coalesce($4,commerce.cart.source_post_id)",
        [u.id, d.skuId, d.qty, d.postId ?? null],
      );
    return { message: d.qty ? "Cart updated" : "Item removed" };
  }
  if (action === "checkout") {
    await flag(db, "commerce");
    requireSandbox();
    const d = z
      .object({
        method: z.enum(["cod", "bkash", "nagad", "card"]),
        address: z.string().trim().min(12).max(500),
        district: z.string().trim().min(2).max(60),
        voucher: z.string().max(30).default(""),
      })
      .parse(raw);
    const cart = await rows(
      db,
      `SELECT c.*,s.price_paisa,s.stock,s.product_id,p.seller_id,p.is_active,p.title_en,cat.commission_bp,se.owner_id,se.state seller_state FROM commerce.cart c JOIN commerce.sku s ON s.id=c.sku_id JOIN commerce.product p ON p.id=s.product_id JOIN commerce.category cat ON cat.id=p.category_id JOIN identity.seller se ON se.id=p.seller_id WHERE c.user_id=$1 ORDER BY s.id FOR UPDATE OF s`,
      [u.id],
    );
    need(cart.length, "Your cart is empty");
    for (const item of cart) {
      need(
        item.is_active && item.seller_state === "active",
        "A product is no longer available",
      );
      need(item.stock >= item.qty, `Not enough stock for ${item.title_en}`);
      need(
        item.owner_id !== u.id,
        "Sellers cannot purchase their own products",
      );
    }
    const groups = Map.groupBy(cart, (x) => x.seller_id);
    const ids: string[] = [];
    for (const [sellerId, items] of groups) {
      const goods = items.reduce((s, i) => s + i.price_paisa * i.qty, 0);
      const delivery = 6000;
      let discount = 0;
      if (d.voucher) {
        const v = await one(
          db,
          "SELECT * FROM commerce.voucher WHERE code=$1 AND seller_id=$2 AND ends_at>now() AND minimum_paisa<=$3",
          [d.voucher.toUpperCase(), sellerId, goods],
        );
        need(
          v,
          "Voucher is invalid, expired, or does not apply to every seller in this cart",
        );
        discount = Math.min(v.amount_paisa, goods - 100);
      }
      const effective = allocate(
        goods - discount,
        items.map((i) => i.price_paisa * i.qty),
      );
      const payable = goods + delivery - discount;
      const order = await one(
        db,
        `INSERT INTO commerce.customer_order(buyer_id,seller_id,payment_method,goods_paisa,delivery_paisa,discount_paisa,payable_paisa,prepaid_paisa,district,address,state,provider_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          u.id,
          sellerId,
          d.method,
          goods,
          delivery,
          discount,
          payable,
          d.method === "cod" ? delivery : payable,
          d.district,
          d.address,
          d.method === "cod" ? "created" : "paid_in_escrow",
          `sandbox-payment-${randomUUID()}`,
        ],
      );
      const id = order!.id;
      ids.push(id);
      const entry = orderMoneyIn({
        orderId: id,
        payablePaisa: d.method === "cod" ? delivery : payable,
        method: "digital",
      });
      await journal(db, { ...entry, idempotencyKey: `order:${id}:prepayment` });
      for (const [index, i] of items.entries()) {
        await db.query("UPDATE commerce.sku SET stock=stock-$2 WHERE id=$1", [
          i.sku_id,
          i.qty,
        ]);
        const line = await one(
          db,
          "INSERT INTO commerce.order_item(order_id,sku_id,qty,unit_paisa,line_paisa,source_post_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
          [
            id,
            i.sku_id,
            i.qty,
            i.price_paisa,
            i.price_paisa * i.qty,
            i.source_post_id,
          ],
        );
        const click = await one(
          db,
          `SELECT cl.* FROM affiliate.click cl WHERE cl.viewer_id=$1 AND cl.product_id=$2 AND cl.clicked_at>now()-interval '7 days' ORDER BY clicked_at DESC LIMIT 1`,
          [u.id, i.product_id],
        );
        if (
          click &&
          click.creator_id !== u.id &&
          click.creator_id !== i.owner_id &&
          !(await blocked(db, u.id, click.creator_id))
        ) {
          const plan = await one(
            db,
            `SELECT p.id,least(coalesce(pp.rate_bp,p.rate_bp),$3::int) rate_bp FROM affiliate.plan p LEFT JOIN affiliate.plan_product pp ON pp.plan_id=p.id AND pp.product_id=$1 WHERE p.seller_id=$2 AND p.is_active AND p.starts_at<=now() AND (p.ends_at IS NULL OR p.ends_at>now()) AND (p.kind='shop' OR pp.product_id IS NOT NULL) AND (p.kind<>'targeted' OR EXISTS(SELECT 1 FROM affiliate.plan_creator pc WHERE pc.plan_id=p.id AND pc.creator_id=$4)) ORDER BY rate_bp DESC LIMIT 1`,
            [i.product_id, sellerId, i.commission_bp, click.creator_id],
          );
          if (plan && plan.rate_bp > 0)
            await db.query(
              "INSERT INTO affiliate.attribution(order_item_id,creator_id,plan_id,click_id,rate_bp) VALUES($1,$2,$3,$4,$5)",
              [line!.id, click.creator_id, plan.id, click.id, plan.rate_bp],
            );
        }
        await db.query(
          "INSERT INTO commerce.item_policy(order_item_id,net_goods_paisa,commission_bp) VALUES($1,$2,$3)",
          [line!.id, effective[index], i.commission_bp],
        );
      }
      await notify(
        db,
        items[0].owner_id,
        "New order",
        `Order ${id.slice(0, 8)} is waiting for buyer confirmation.`,
      );
    }
    await db.query("DELETE FROM commerce.cart WHERE user_id=$1", [u.id]);
    return {
      ids,
      message: "Order placed. Confirm your delivery details in Orders.",
    };
  }
  if (action === "order") {
    const d = z
      .object({
        id: uuid,
        step: z.enum([
          "confirm",
          "ship",
          "deliver",
          "cancel",
          "return",
          "refund",
          "rto",
        ]),
        reason: z.string().trim().max(500).default(""),
        courier: z.number().int().min(1).max(6).default(1),
      })
      .parse(raw);
    await flag(db, "commerce");
    requireSandbox();
    const o = await one(
      db,
      "SELECT o.*,s.owner_id FROM commerce.customer_order o JOIN identity.seller s ON s.id=o.seller_id WHERE o.id=$1 FOR UPDATE OF o",
      [d.id],
    );
    need(o, "Order not found", 404);
    const buyer = o.buyer_id === u.id;
    const seller = o.owner_id === u.id;
    const admin = u.roles.includes("admin");
    need(
      buyer || seller || admin,
      "This order belongs to another account",
      403,
    );
    const items = await rows(
      db,
      "SELECT i.*,p.net_goods_paisa,p.commission_bp FROM commerce.order_item i JOIN commerce.item_policy p ON p.order_item_id=i.id WHERE order_id=$1",
      [o.id],
    );
    if (d.step === "confirm") {
      need(buyer, "Only the buyer can confirm the delivery address", 403);
      need(
        ["created", "paid_in_escrow"].includes(o.state),
        "Order already confirmed",
        409,
      );
      await db.query(
        "UPDATE commerce.customer_order SET state='confirmed',confirmed_at=now() WHERE id=$1",
        [o.id],
      );
    } else if (d.step === "ship") {
      need(seller || admin, "Only the seller can dispatch", 403);
      need(
        o.state === "confirmed" && o.confirmed_at,
        "Buyer confirmation is required before dispatch",
        409,
      );
      const tracking = `SANDBOX-${randomUUID().slice(0, 8).toUpperCase()}`;
      await db.query(
        "INSERT INTO commerce.shipment(order_id,courier_id,tracking,state,otp_confirmed_at,dispatched_at) VALUES($1,$2,$3,'in_transit',$4,now())",
        [o.id, d.courier, tracking, o.confirmed_at],
      );
      await db.query(
        "UPDATE commerce.customer_order SET state='shipped' WHERE id=$1",
        [o.id],
      );
      await notify(
        db,
        o.buyer_id,
        "Order dispatched",
        `Sandbox tracking: ${tracking}`,
      );
    } else if (d.step === "deliver") {
      need(
        buyer || admin,
        "Delivery must be confirmed by the buyer or operations",
        403,
      );
      need(o.state === "shipped", "Only shipped orders can be delivered", 409);
      if (o.payment_method === "cod") {
        const remainder = o.payable_paisa - o.prepaid_paisa;
        await journal(
          db,
          orderMoneyIn({
            orderId: o.id,
            payablePaisa: remainder,
            method: "cod",
          }),
        );
        await journal(db, {
          kind: "manual_correction",
          idempotencyKey: `order:${o.id}:cod-settle`,
          description: "Sandbox courier cash settlement",
          orderId: o.id,
          lines: [
            { account: { kind: "cash_mfs" }, amount: remainder },
            { account: { kind: "cod_receivable" }, amount: -remainder },
          ],
        });
      }
      const commission = items.reduce(
        (s, i) => s + shareBp(i.net_goods_paisa, i.commission_bp),
        0,
      );
      const shipment = await one(
        db,
        "SELECT courier_id FROM commerce.shipment WHERE order_id=$1",
        [o.id],
      );
      const courierId = `00000000-0000-4000-8000-${String(shipment!.courier_id).padStart(12, "0")}`;
      const release = releaseEscrow({
        orderId: o.id,
        sellerId: o.seller_id,
        goodsPaisa: o.goods_paisa,
        deliveryPaisa: o.delivery_paisa,
        discountPaisa: o.discount_paisa,
        commissionPaisa: commission,
        courierId,
      });
      const sellerNet = release.sellerNetPaisa;
      await journal(db, release.entry);
      for (const i of items) {
        const at = await one(
          db,
          "SELECT * FROM affiliate.attribution WHERE order_item_id=$1 AND rejected_reason IS NULL",
          [i.id],
        );
        if (!at || shareBp(i.net_goods_paisa, at.rate_bp) === 0) continue;
        const a = accrueCommission({
          orderId: o.id,
          orderItemId: i.id,
          creatorId: at.creator_id,
          goodsPaisa: i.net_goods_paisa,
          rateBp: at.rate_bp,
          deliveredAt: new Date(),
        });
        const entryId = await journal(db, a.entry);
        await db.query(
          "INSERT INTO ledger.commission_accrual(order_item_id,creator_id,seller_id,gross_paisa,rate_bp,commission_paisa,withholding_paisa,net_paisa,hold_until,accrued_entry_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            i.id,
            at.creator_id,
            o.seller_id,
            i.net_goods_paisa,
            at.rate_bp,
            a.commissionPaisa,
            a.withholdingPaisa,
            a.netPaisa,
            a.holdUntil,
            entryId,
          ],
        );
        await notify(
          db,
          at.creator_id,
          "Commission earned",
          "Your commission is held for the 7-day return window.",
        );
      }
      await db.query(
        "UPDATE commerce.customer_order SET state='delivered',delivered_at=now(),escrow_released_at=now(),return_window_ends=now()+interval '7 days',seller_net_paisa=$2 WHERE id=$1",
        [o.id, sellerNet],
      );
      await db.query(
        `INSERT INTO ads.event(campaign_id,user_id,kind) SELECT DISTINCT c.id,$2::uuid,'conversion' FROM ads.campaign c JOIN commerce.order_item i ON i.order_id=$1 JOIN commerce.sku sk ON sk.id=i.sku_id AND sk.product_id=c.product_id WHERE EXISTS(SELECT 1 FROM ads.event e WHERE e.campaign_id=c.id AND e.user_id=$2 AND e.kind='click' AND e.day>=current_date-7) ON CONFLICT DO NOTHING`,
        [o.id, o.buyer_id],
      );
      await db.query(
        "UPDATE commerce.shipment SET state='delivered',settled_at=now() WHERE order_id=$1",
        [o.id],
      );
    } else if (d.step === "return") {
      need(buyer, "Only the buyer can request a return", 403);
      need(
        o.state === "delivered" && new Date(o.return_window_ends) > new Date(),
        "The return window is closed",
        409,
      );
      need(d.reason.length >= 5, "Describe the reason for the return");
      await db.query(
        "UPDATE commerce.customer_order SET state='returned',return_reason=$2 WHERE id=$1",
        [o.id, d.reason],
      );
    } else if (d.step === "refund") {
      need(
        seller || admin,
        "Only the seller or operations can approve a refund",
        403,
      );
      need(o.state === "returned", "A return request is required", 409);
      for (const i of items) {
        const a = await one(
          db,
          "SELECT * FROM ledger.commission_accrual WHERE order_item_id=$1",
          [i.id],
        );
        if (a && a.state === "held") {
          await journal(
            db,
            clawBackCommission({
              orderItemId: i.id,
              creatorId: a.creator_id,
              commissionPaisa: a.commission_paisa,
              withholdingPaisa: a.withholding_paisa,
              reason: o.return_reason,
            }),
          );
          await db.query(
            "UPDATE ledger.commission_accrual SET state='clawed_back' WHERE id=$1",
            [a.id],
          );
        }
      }
      await reverse(
        db,
        o.id,
        "escrow_released_to_seller",
        `order:${o.id}:reverse-release`,
      );
      await journal(db, {
        kind: "refund_issued",
        idempotencyKey: `order:${o.id}:refund`,
        description: "Full sandbox return refund",
        orderId: o.id,
        lines: [
          { account: { kind: "escrow" }, amount: o.payable_paisa },
          { account: { kind: "cash_mfs" }, amount: -o.payable_paisa },
        ],
      });
      await db.query(
        "UPDATE commerce.customer_order SET state='refunded' WHERE id=$1",
        [o.id],
      );
      for (const i of items)
        await db.query("UPDATE commerce.sku SET stock=stock+$2 WHERE id=$1", [
          i.sku_id,
          i.qty,
        ]);
    } else {
      const rto = d.step === "rto";
      need(
        rto ? seller || admin : buyer || seller || admin,
        "Action not permitted",
        403,
      );
      need(
        rto
          ? o.state === "shipped"
          : ["created", "paid_in_escrow", "confirmed"].includes(o.state),
        "This order cannot be cancelled",
        409,
      );
      if (o.prepaid_paisa)
        await journal(db, {
          kind: "refund_issued",
          idempotencyKey: `order:${o.id}:cancel-refund`,
          description: "Sandbox cancellation refund",
          orderId: o.id,
          lines: [
            { account: { kind: "escrow" }, amount: o.prepaid_paisa },
            { account: { kind: "cash_mfs" }, amount: -o.prepaid_paisa },
          ],
        });
      if (rto) {
        const shipment = await one(
          db,
          "SELECT courier_id FROM commerce.shipment WHERE order_id=$1",
          [o.id],
        );
        const courierId = `00000000-0000-4000-8000-${String(shipment!.courier_id).padStart(12, "0")}`;
        await journal(
          db,
          absorbRtoCost({ orderId: o.id, courierId, costPaisa: 6000 }),
        );
      }
      await db.query(
        "UPDATE commerce.customer_order SET state='cancelled',return_reason=$2 WHERE id=$1",
        [o.id, rto ? "Returned to origin" : d.reason],
      );
      if (rto)
        await db.query(
          "UPDATE commerce.shipment SET state='returned_to_origin' WHERE order_id=$1",
          [o.id],
        );
      for (const i of items)
        await db.query("UPDATE commerce.sku SET stock=stock+$2 WHERE id=$1", [
          i.sku_id,
          i.qty,
        ]);
    }
    await db.query(
      `UPDATE identity.seller SET bharosha=(SELECT CASE WHEN count(*)=0 THEN 0 ELSE round(100.0*count(*) FILTER(WHERE state IN ('delivered','completed'))/count(*),1) END FROM commerce.customer_order WHERE seller_id=$1 AND state IN ('delivered','completed','refunded','cancelled','returned')) WHERE id=$1`,
      [o.seller_id],
    );
    return { message: `Order ${d.step} recorded` };
  }
  if (action === "voucher") {
    const s = await sellerFor(db, u);
    const d = z
      .object({
        code: z.string().regex(/^[A-Z0-9]{3,20}$/),
        amount: z.number().int().min(100).max(100000),
        minimum: z.number().int().min(100).max(100000000),
      })
      .parse(raw);
    need(d.amount < d.minimum, "Discount must be below minimum spend");
    await db.query(
      "INSERT INTO commerce.voucher(code,seller_id,amount_paisa,minimum_paisa,ends_at) VALUES($1,$2,$3,$4,now()+interval '30 days')",
      [d.code, s.id, d.amount, d.minimum],
    );
    return { message: "Voucher created for 30 days" };
  }
  return undefined;
}
