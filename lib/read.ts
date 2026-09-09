import { z } from "zod";
import { adToken } from "./providers";
import { type User, sessionInfo, hasRole, adult, blocked } from "./auth";
import { pool, one, rows, need, type Row } from "./db";
import { rank, searchTerms } from "../packages/ranking/src/index.ts";
const productSql = `SELECT p.*,s.trade_name,s.bharosha,s.owner_id,c.commission_bp,c.name_en category_en,c.name_bn category_bn,
 (SELECT json_agg(sk ORDER BY sk.code) FROM commerce.sku sk WHERE sk.product_id=p.id) skus,
 EXISTS(SELECT 1 FROM affiliate.showcase sh WHERE sh.product_id=p.id AND sh.creator_id=$1) showcased
 FROM commerce.product p JOIN identity.seller s ON s.id=p.seller_id JOIN commerce.category c ON c.id=p.category_id`;
export async function readApp(u: User, url: URL) {
  const view = z
    .enum([
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
      "partner",
      "admin",
    ])
    .parse(url.searchParams.get("view") ?? "feed");
  const base: Row = {
    _view: view,
    ...(await sessionInfo(u)),
    flags: await rows(pool, "SELECT * FROM app.flag"),
    notifications: await rows(
      pool,
      "SELECT * FROM app.notification WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
      [u.id],
    ),
    categories: await rows(pool, "SELECT * FROM commerce.category"),
    seller:
      (await one(pool, "SELECT * FROM identity.seller WHERE owner_id=$1", [
        u.id,
      ])) ?? null,
  };
  base.products = await rows(
    pool,
    `${productSql} WHERE p.is_active AND s.state='active' ORDER BY p.created_at DESC LIMIT 100`,
    [u.id],
  );
  base.sellers = await rows(
    pool,
    "SELECT id,trade_name,bharosha FROM identity.seller WHERE state='active'",
  );
  base.cart = await rows(
    pool,
    `SELECT ca.*,sk.price_paisa,sk.variant_label,sk.stock,p.title_en,p.title_bn,p.cover,p.seller_id FROM commerce.cart ca JOIN commerce.sku sk ON sk.id=ca.sku_id JOIN commerce.product p ON p.id=sk.product_id WHERE ca.user_id=$1`,
    [u.id],
  );
  base.wallet = await rows(
    pool,
    "SELECT kind,balance_paisa FROM ledger.account_balance WHERE owner_id=$1",
    [u.id],
  );
  if (view === "feed" || view === "cut") {
    const mode = z
      .enum(["for-you", "following", "pashe"])
      .parse(url.searchParams.get("mode") ?? "for-you");
    const postId = z
      .string()
      .uuid()
      .nullable()
      .parse(url.searchParams.get("post"));
    let cursor: { at: string; id: string } | null = null;
    const encodedCursor = url.searchParams.get("cursor");
    if (encodedCursor) {
      need(encodedCursor.length < 300, "Invalid feed cursor");
      try {
        cursor = z
          .object({
            at: z.string().datetime({ offset: true }),
            id: z.string().uuid(),
          })
          .parse(
            JSON.parse(Buffer.from(encodedCursor, "base64url").toString()),
          );
      } catch {
        need(false, "Invalid feed cursor");
      }
    }
    const terms = searchTerms(url.searchParams.get("q") ?? "");
    const posts = await rows(
      pool,
      `SELECT p.*,to_char(p.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_time,u.handle,u.display_name,coalesce(st.plays,0) plays,coalesce(st.likes,0) likes,coalesce(st.comments,0) comments,coalesce(st.completions,0) completions,coalesce(st.reports,0) reports,coalesce(a.served_impressions,0) served_impressions,coalesce(a.guaranteed_impressions,500) guaranteed_impressions,m.mime,
   EXISTS(SELECT 1 FROM content.follow f WHERE f.follower_id=$1 AND f.followee_id=p.author_id) following,
   EXISTS(SELECT 1 FROM content.reaction r WHERE r.user_id=$1 AND r.post_id=p.id) liked,
   coalesce((SELECT json_agg(pp.product_id) FROM commerce.post_product pp WHERE pp.post_id=p.id),'[]') product_ids,
   (SELECT json_agg(cl ORDER BY cl.pinned DESC,cl.created_at DESC) FROM (SELECT c.id,c.user_id,c.body,c.pinned,cu.display_name name,c.created_at FROM content.comment c JOIN identity.user_account cu ON cu.id=c.user_id WHERE c.post_id=p.id AND cu.state='active' AND NOT EXISTS(SELECT 1 FROM app.block b WHERE (b.user_id=$1 AND b.target_id=c.user_id) OR (b.target_id=$1 AND b.user_id=c.user_id)) ORDER BY c.pinned DESC,c.created_at DESC,c.id LIMIT 30) cl) comment_list,
   ns.allow_duet,ns.allow_stitch
   FROM content.post p JOIN identity.user_account u ON u.id=p.author_id LEFT JOIN content.post_stats st ON st.post_id=p.id LEFT JOIN content.audition a ON a.post_id=p.id LEFT JOIN app.media m ON m.id=p.media_id LEFT JOIN trust.nirapod_setting ns ON ns.user_id=p.author_id
   WHERE p.state='published' AND u.state='active' AND NOT EXISTS(SELECT 1 FROM app.block b WHERE (b.user_id=$1 AND b.target_id=p.author_id) OR (b.target_id=$1 AND b.user_id=p.author_id))
   AND ($2='for-you' OR EXISTS(SELECT 1 FROM content.follow f WHERE f.follower_id=$1 AND f.followee_id=p.author_id))
   AND ($2<>'pashe' OR EXISTS(SELECT 1 FROM content.follow f WHERE f.followee_id=$1 AND f.follower_id=p.author_id))
   AND (EXISTS(SELECT 1 FROM unnest($3::text[]) term WHERE lower(coalesce(p.caption,'')||' '||u.handle||' '||u.display_name) LIKE '%'||term||'%'))
   AND ($4::timestamptz IS NULL OR (p.published_at,p.id)<($4::timestamptz,$5::uuid))
   AND ($6::uuid IS NULL OR p.id=$6)
   AND ($7::boolean=false OR NOT coalesce(ns.hide_from_search,false) OR p.author_id=$1)
   ORDER BY p.published_at DESC,p.id DESC LIMIT 61`,
      [
        u.id,
        mode,
        terms,
        postId ? null : (cursor?.at ?? null),
        cursor?.id ?? null,
        postId,
        terms[0].length > 0,
      ],
    );
    const page = posts.slice(0, 60);
    const last = page.at(-1);
    base.nextCursor =
      !postId && posts.length > 60 && last
        ? Buffer.from(
            JSON.stringify({ at: last.cursor_time, id: last.id }),
          ).toString("base64url")
        : null;
    base.feedCursor = encodedCursor ?? "";
    base.sharedPost = postId;
    base.posts = rank(page as any);
    base.ads = [];
    if (
      view === "feed" &&
      base.posts.length >= 4 &&
      base.flags.find((f: Row) => f.name === "ads")?.enabled
    ) {
      const ads = await rows(
        pool,
        `SELECT c.id,c.name,c.product_id,c.bid_paisa,p.id post_id,p.caption,p.cover,p.media_id,p.author_id,u.display_name,u.handle FROM ads.campaign c JOIN ads.advertiser a ON a.id=c.advertiser_id JOIN ads.creative cr ON cr.campaign_id=c.id JOIN content.post p ON p.id=cr.post_id JOIN identity.user_account u ON u.id=p.author_id JOIN ads.consent con ON con.post_id=p.id AND con.seller_id=a.seller_id WHERE c.state='active' AND p.state='published' AND c.starts_at<=now() AND (c.ends_at IS NULL OR c.ends_at>now()) AND a.owner_id<>$1 AND p.author_id<>$1 AND c.spent_paisa+c.bid_paisa<=c.total_budget_paisa AND (SELECT coalesce(sum(e.cost_paisa),0) FROM ads.event e WHERE e.campaign_id=c.id AND day=current_date)+c.bid_paisa<=c.daily_budget_paisa AND EXISTS(SELECT 1 FROM ledger.account_balance b WHERE b.kind='coin_liability' AND b.owner_id=a.owner_id AND b.balance_paisa>=c.bid_paisa) AND NOT EXISTS(SELECT 1 FROM app.block b WHERE (b.user_id=$1 AND b.target_id=p.author_id) OR (b.target_id=$1 AND b.user_id=p.author_id)) ORDER BY c.bid_paisa DESC,c.created_at LIMIT 1`,
        [u.id],
      );
      base.ads = ads.map((ad) => ({ ...ad, token: adToken(u.id, ad.id) }));
    }
  }
  if (["orders", "seller"].includes(view)) {
    base.orders = await rows(
      pool,
      `SELECT o.*,s.trade_name,s.owner_id,(SELECT json_agg(json_build_object('title',p.title_en,'qty',i.qty,'unit_paisa',i.unit_paisa,'variant',sk.variant_label)) FROM commerce.order_item i JOIN commerce.sku sk ON sk.id=i.sku_id JOIN commerce.product p ON p.id=sk.product_id WHERE i.order_id=o.id) items,(SELECT tracking FROM commerce.shipment WHERE order_id=o.id LIMIT 1) tracking FROM commerce.customer_order o JOIN identity.seller s ON s.id=o.seller_id WHERE ${view === "seller" ? "s.owner_id" : "o.buyer_id"}=$1 ORDER BY placed_at DESC LIMIT 100`,
      [u.id],
    );
  }
  if (view === "seller") {
    base.ownProducts = await rows(
      pool,
      `${productSql} WHERE s.owner_id=$1 ORDER BY p.created_at DESC`,
      [u.id],
    );
    base.vouchers = await rows(
      pool,
      "SELECT v.* FROM commerce.voucher v JOIN identity.seller s ON s.id=v.seller_id WHERE s.owner_id=$1",
      [u.id],
    );
  }
  if (["studio", "affiliate", "seller"].includes(view)) {
    base.samples = await rows(
      pool,
      "SELECT r.*,p.title_en,u.display_name,p.seller_id,s.owner_id FROM affiliate.sample_request r JOIN commerce.product p ON p.id=r.product_id JOIN identity.seller s ON s.id=p.seller_id JOIN identity.user_account u ON u.id=r.creator_id WHERE r.creator_id=$1 OR s.owner_id=$1 ORDER BY r.created_at DESC",
      [u.id],
    );
    base.plans = await rows(
      pool,
      `SELECT p.*,s.trade_name,pp.product_id FROM affiliate.plan p JOIN identity.seller s ON s.id=p.seller_id LEFT JOIN affiliate.plan_product pp ON pp.plan_id=p.id WHERE p.is_active AND (p.kind<>'targeted' OR s.owner_id=$1 OR EXISTS(SELECT 1 FROM affiliate.plan_creator pc WHERE pc.plan_id=p.id AND pc.creator_id=$1))`,
      [u.id],
    );
    base.accruals = await rows(
      pool,
      "SELECT a.*,p.title_en FROM ledger.commission_accrual a JOIN commerce.order_item i ON i.id=a.order_item_id JOIN commerce.sku sk ON sk.id=i.sku_id JOIN commerce.product p ON p.id=sk.product_id WHERE creator_id=$1 ORDER BY a.created_at DESC",
      [u.id],
    );
    base.briefs = await rows(
      pool,
      `SELECT b.*,s.trade_name,s.owner_id,EXISTS(SELECT 1 FROM app.application ap WHERE ap.brief_id=b.id AND ap.creator_id=$1) applied,(SELECT json_agg(json_build_object('creator_id',ap.creator_id,'name',u.display_name,'pitch',ap.pitch,'state',ap.state)) FROM app.application ap JOIN identity.user_account u ON u.id=ap.creator_id WHERE ap.brief_id=b.id AND (s.owner_id=$1 OR ap.creator_id=$1)) applications FROM app.brief b JOIN identity.seller s ON s.id=b.seller_id ORDER BY b.id`,
      [u.id],
    );
  }
  if (["studio", "cut", "profile", "ads"].includes(view)) {
    base.ownPosts = await rows(
      pool,
      "SELECT p.*,parent.id parent_id,parent.caption parent_caption,ns.allow_duet parent_allow_duet,ns.allow_stitch parent_allow_stitch,s.plays,s.completions,s.watch_ms_total,s.likes,s.comments,coalesce((SELECT json_agg(pp.product_id) FROM commerce.post_product pp WHERE pp.post_id=p.id),'[]') product_ids FROM content.post p LEFT JOIN content.post_stats s ON s.post_id=p.id LEFT JOIN content.post_derivation pd ON pd.child_id=p.id LEFT JOIN content.post parent ON parent.id=pd.parent_id LEFT JOIN trust.nirapod_setting ns ON ns.user_id=parent.author_id WHERE p.author_id=$1 ORDER BY p.created_at DESC",
      [u.id],
    );
  }
  if (["studio", "profile", "seller"].includes(view)) {
    base.payouts = await rows(
      pool,
      "SELECT p.*,m.channel FROM ledger.payout p JOIN identity.payout_method m ON m.id=p.payout_method_id WHERE payee_id=$1 ORDER BY requested_at DESC LIMIT 50",
      [u.id],
    );
    base.methods = await rows(
      pool,
      "SELECT id,channel,'••••'||right(account_ref,4) masked,is_default,verified_at FROM identity.payout_method WHERE user_id=$1",
      [u.id],
    );
    base.kyc =
      (await one(
        pool,
        "SELECT id,state,created_at FROM identity.kyc_record WHERE subject_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",
        [u.id],
      )) ?? null;
    base.lessons = await rows(
      pool,
      "SELECT lesson FROM app.academy_progress WHERE user_id=$1",
      [u.id],
    );
    base.sellerBalance = base.seller
      ? (await one(
          pool,
          "SELECT coalesce((SELECT balance_paisa FROM ledger.account_balance WHERE owner_id=$1 AND kind='seller_payable'),0)-coalesce((SELECT sum(seller_net_paisa) FROM commerce.customer_order WHERE seller_id=$1 AND (state='returned' OR state='delivered' AND return_window_ends>now())),0) available",
          [base.seller.id],
        ))!.available
      : 0;
  }
  if (view === "live") {
    base.rooms = await rows(
      pool,
      "SELECT s.*,u.display_name,u.handle FROM live.session s JOIN identity.user_account u ON u.id=s.host_id WHERE s.state='live' AND u.state='active' AND NOT EXISTS(SELECT 1 FROM app.block b WHERE (b.user_id=$1 AND b.target_id=s.host_id) OR (b.target_id=$1 AND b.user_id=s.host_id)) ORDER BY s.started_at DESC",
      [u.id],
    );
    base.gifts = await rows(
      pool,
      "SELECT * FROM live.gift_catalog WHERE is_active ORDER BY id",
    );
  }
  if (view === "profile") {
    base.settings =
      (await one(pool, "SELECT * FROM trust.nirapod_setting WHERE user_id=$1", [
        u.id,
      ])) ?? {};
    base.profile =
      (await one(
        pool,
        "SELECT * FROM identity.creator_profile WHERE user_id=$1",
        [u.id],
      )) ?? {};
    base.blocks = await rows(
      pool,
      "SELECT u.id,u.display_name FROM app.block b JOIN identity.user_account u ON u.id=b.target_id WHERE b.user_id=$1",
      [u.id],
    );
    base.cases = await rows(
      pool,
      "SELECT c.*,a.reason_bn,a.reason_en,EXISTS(SELECT 1 FROM trust.appeal ap WHERE ap.case_id=c.id) appealed FROM trust.moderation_case c JOIN LATERAL(SELECT * FROM trust.moderation_action WHERE case_id=c.id ORDER BY acted_at DESC LIMIT 1) a ON true WHERE subject_id=$1 ORDER BY opened_at DESC",
      [u.id],
    );
  }
  if (view === "inbox")
    base.messages = await rows(
      pool,
      "SELECT m.*,u.display_name sender_name,r.display_name recipient_name FROM app.message m JOIN identity.user_account u ON u.id=m.sender_id JOIN identity.user_account r ON r.id=m.recipient_id WHERE (sender_id=$1 OR recipient_id=$1) AND NOT EXISTS(SELECT 1 FROM app.block b WHERE (b.user_id=$1 AND b.target_id=CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END) OR (b.target_id=$1 AND b.user_id=CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END)) ORDER BY m.created_at DESC LIMIT 100",
      [u.id],
    );
  if (view === "ads") {
    base.consentPosts = await rows(
      pool,
      "SELECT p.id,p.caption,u.display_name FROM ads.consent c JOIN content.post p ON p.id=c.post_id JOIN identity.seller s ON s.id=c.seller_id JOIN identity.user_account u ON u.id=p.author_id WHERE s.owner_id=$1",
      [u.id],
    );
    base.consents = await rows(
      pool,
      "SELECT c.*,s.trade_name,p.caption FROM ads.consent c JOIN content.post p ON p.id=c.post_id JOIN identity.seller s ON s.id=c.seller_id WHERE p.author_id=$1",
      [u.id],
    );
    base.campaigns = await rows(
      pool,
      `SELECT c.*,(SELECT count(*) FROM ads.event e WHERE campaign_id=c.id AND kind='impression') impressions,(SELECT count(*) FROM ads.event e WHERE campaign_id=c.id AND kind='click') clicks,(SELECT count(*) FROM ads.event e WHERE campaign_id=c.id AND kind='conversion') conversions FROM ads.campaign c JOIN ads.advertiser a ON a.id=c.advertiser_id WHERE a.owner_id=$1 ORDER BY created_at DESC`,
      [u.id],
    );
  }
  if (view === "partner") {
    need(hasRole(u, "partner"), "Partner access required", 403);
    base.leads = await rows(
      pool,
      "SELECT * FROM app.partner_lead WHERE partner_id=$1 ORDER BY created_at DESC",
      [u.id],
    );
  }
  if (view === "admin") {
    need(hasRole(u, "admin"), "Operations access required", 403);
    base.trial = await one(pool, "SELECT * FROM ledger.trial_balance");
    base.journals = await rows(
      pool,
      "SELECT * FROM ledger.journal_entry ORDER BY created_at DESC LIMIT 30",
    );
    base.cases = await rows(
      pool,
      `SELECT c.*,u.display_name,p.caption,
        (SELECT count(*) FROM trust.report r WHERE r.case_id=c.id OR r.case_id IS NULL AND r.post_id=c.post_id AND r.category=c.category) report_count,
        (SELECT json_agg(e) FROM (SELECT r.category,r.note,r.created_at FROM trust.report r WHERE r.case_id=c.id OR r.case_id IS NULL AND r.post_id=c.post_id AND r.category=c.category ORDER BY r.created_at DESC LIMIT 20) e) evidence,
        (c.severity='critical' AND c.state IN ('open','human_review','appealed') AND c.opened_at<now()-interval '15 minutes') overdue,
        (SELECT statement FROM trust.appeal WHERE case_id=c.id) appeal_statement FROM trust.moderation_case c JOIN identity.user_account u ON u.id=c.subject_id LEFT JOIN content.post p ON p.id=c.post_id ORDER BY (c.state IN ('open','human_review','appealed')) DESC,(c.severity='critical') DESC,(c.severity='high') DESC,c.opened_at,c.id LIMIT 100`,
    );
    base.safetySummary = await one(
      pool,
      "SELECT count(*) FILTER(WHERE state IN ('open','human_review','appealed')) pending,count(*) FILTER(WHERE severity='critical' AND state IN ('open','human_review','appealed') AND opened_at<now()-interval '15 minutes') overdue FROM trust.moderation_case",
    );
    base.pendingSellers = await rows(
      pool,
      "SELECT * FROM identity.seller WHERE state='pending_review'",
    );
    base.pendingKyc = await rows(
      pool,
      "SELECT k.id,k.state,u.display_name FROM identity.kyc_record k JOIN identity.user_account u ON u.id=k.subject_id WHERE k.state='submitted' AND k.id=(SELECT id FROM identity.kyc_record WHERE subject_id=k.subject_id ORDER BY created_at DESC,id DESC LIMIT 1)",
    );
    base.pendingCampaigns = await rows(
      pool,
      "SELECT * FROM ads.campaign WHERE state='pending_review'",
    );
    base.audit = await rows(
      pool,
      "SELECT a.*,u.display_name FROM app.audit a LEFT JOIN identity.user_account u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 30",
    );
    base.leads = await rows(
      pool,
      "SELECT * FROM app.partner_lead ORDER BY created_at DESC",
    );
  }
  return base;
}
export async function readLive(u: User, url: URL) {
  adult(u);
  const id = url.searchParams.get("id");
  need(id && /^[0-9a-f-]{36}$/i.test(id), "Invalid room");
  const s = await one(
    pool,
    "SELECT s.* FROM live.session s JOIN identity.user_account u ON u.id=s.host_id WHERE s.id=$1 AND u.state='active'",
    [id],
  );
  need(s && !(await blocked(pool, u.id, s.host_id)), "Room unavailable", 404);
  const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
  return {
    room: s,
    signals: await rows(
      pool,
      "SELECT id,sender_id,payload FROM live.signal WHERE session_id=$1 AND recipient_id=$2 AND id>$3 AND created_at>now()-interval '5 minutes' ORDER BY id LIMIT 100",
      [id, u.id, after],
    ),
    chat: await rows(
      pool,
      "SELECT c.*,u.display_name FROM live.chat c JOIN identity.user_account u ON u.id=c.user_id WHERE session_id=$1 AND NOT EXISTS(SELECT 1 FROM app.block b WHERE (b.user_id=$2 AND b.target_id=c.user_id) OR (b.target_id=$2 AND b.user_id=c.user_id)) ORDER BY id DESC LIMIT 50",
      [id, u.id],
    ),
  };
}
