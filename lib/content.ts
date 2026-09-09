import { z } from "zod";
import { type DB, type Row, one, rows, need, flag, notify, audit } from "./db";
import { type User, adult, blocked } from "./auth";
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(1000);
export async function visiblePost(db: DB, u: User, id: string) {
  const p = await one(
    db,
    `SELECT p.* FROM content.post p JOIN identity.user_account a ON a.id=p.author_id WHERE p.id=$1 AND p.state='published' AND a.state='active'`,
    [id],
  );
  need(p, "Post is unavailable", 404);
  need(!(await blocked(db, u.id, p.author_id)), "Post is unavailable", 404);
  return p;
}
export async function contentCommand(
  db: DB,
  u: User,
  action: string,
  raw: Row,
): Promise<Row | undefined> {
  if (action === "preference") {
    const d = z
      .object({
        locale: z.enum(["bn", "en"]).optional(),
        dataSaver: z.boolean().optional(),
      })
      .parse(raw);
    await db.query(
      "UPDATE identity.user_account SET locale=coalesce($2,locale),data_saver=coalesce($3,data_saver) WHERE id=$1",
      [u.id, d.locale ?? null, d.dataSaver ?? null],
    );
    return { ok: true };
  }
  if (action === "profile") {
    const d = z
      .object({
        name: z.string().trim().min(1).max(40),
        bio: z.string().max(200),
        locale: z.enum(["bn", "en"]),
        dataSaver: z.boolean(),
        dm: z.enum(["nobody", "following", "everyone"]),
        filter: z.enum(["off", "standard", "strict"]),
        duet: z.boolean(),
        stitch: z.boolean(),
      })
      .parse(raw);
    await db.query(
      "UPDATE identity.user_account SET display_name=$2,locale=$3,data_saver=$4 WHERE id=$1",
      [u.id, d.name, d.locale, d.dataSaver],
    );
    await db.query(
      "INSERT INTO identity.creator_profile(user_id,bio) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET bio=$2",
      [u.id, d.bio],
    );
    await db.query(
      `INSERT INTO trust.nirapod_setting(user_id,dm_from,comment_filter,allow_duet,allow_stitch) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET dm_from=$2,comment_filter=$3,allow_duet=$4,allow_stitch=$5`,
      [u.id, d.dm, d.filter, d.duet, d.stitch],
    );
    return { message: "Profile and safety settings saved" };
  }
  if (action === "post") {
    await flag(db, "uploads");
    const d = z
      .object({
        id: uuid.optional(),
        caption: z.string().trim().min(1).max(2200),
        mediaId: uuid.optional(),
        productId: uuid.optional(),
        template: z.enum([
          "original",
          "product-story",
          "day-in-life",
          "duet",
          "stitch",
        ]),
        parentId: uuid.optional(),
        captions: z.string().max(5000).default(""),
        trimStart: z.number().min(0).max(599).default(0),
        trimEnd: z.number().min(1).max(600).optional(),
        publish: z.boolean(),
      })
      .parse(raw);
    need(
      d.trimEnd === undefined || d.trimEnd > d.trimStart,
      "Trim end must be after start",
    );
    if (d.mediaId)
      need(
        await one(db, "SELECT 1 FROM app.media WHERE id=$1 AND owner_id=$2", [
          d.mediaId,
          u.id,
        ]),
        "Upload belongs to another account",
        403,
      );
    if (d.id)
      need(
        await one(
          db,
          `SELECT 1 FROM content.post WHERE id=$1 AND author_id=$2 AND state='uploading'`,
          [d.id, u.id],
        ),
        "Only your drafts can be edited",
        403,
      );
    if (d.parentId) {
      const parent = await visiblePost(db, u, d.parentId);
      const settings = await one(
        db,
        "SELECT * FROM trust.nirapod_setting WHERE user_id=$1",
        [parent.author_id],
      );
      need(
        d.template === "duet"
          ? settings?.allow_duet
          : d.template === "stitch"
            ? settings?.allow_stitch
            : true,
        "The creator has disabled this remix",
        403,
      );
    }
    if (["duet", "stitch"].includes(d.template))
      need(d.parentId, "Choose a source post to remix");
    if (d.productId)
      need(
        await one(
          db,
          "SELECT 1 FROM commerce.product WHERE id=$1 AND is_active",
          [d.productId],
        ),
        "Product is unavailable",
      );
    const media = d.mediaId
      ? await one(db, "SELECT mime FROM app.media WHERE id=$1", [d.mediaId])
      : null;
    const kind = media?.mime.startsWith("video/") ? "video" : "photo_carousel";
    const state = d.publish ? "published" : "uploading";
    let p: Row | undefined;
    if (d.id)
      p = await one(
        db,
        `UPDATE content.post SET caption=$2,media_id=$3,state=$4,published_at=CASE WHEN $4::content.publish_state='published' THEN now() ELSE NULL END,template=$5,captions=$6,trim_start=$7,trim_end=$8,kind=$9 WHERE id=$1 RETURNING id`,
        [
          d.id,
          d.caption,
          d.mediaId ?? null,
          state,
          d.template,
          d.captions,
          d.trimStart,
          d.trimEnd ?? null,
          kind,
        ],
      );
    else
      p = await one(
        db,
        `INSERT INTO content.post(author_id,caption,caption_lang,state,published_at,template,captions,media_id,trim_start,trim_end,kind) VALUES($1,$2,$3,$4,CASE WHEN $4::content.publish_state='published' THEN now() ELSE NULL END,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          u.id,
          d.caption,
          u.locale,
          state,
          d.template,
          d.captions,
          d.mediaId ?? null,
          d.trimStart,
          d.trimEnd ?? null,
          kind,
        ],
      );
    await db.query(
      "INSERT INTO content.post_stats(post_id) VALUES($1) ON CONFLICT DO NOTHING",
      [p!.id],
    );
    await db.query(
      "INSERT INTO content.audition(post_id) VALUES($1) ON CONFLICT DO NOTHING",
      [p!.id],
    );
    await db.query("DELETE FROM commerce.post_product WHERE post_id=$1", [
      p!.id,
    ]);
    if (d.productId)
      await db.query(
        "INSERT INTO commerce.post_product(post_id,product_id,tagged_by) VALUES($1,$2,$3)",
        [p!.id, d.productId, u.id],
      );
    if (d.parentId)
      await db.query(
        "INSERT INTO content.post_derivation(child_id,parent_id,kind) VALUES($1,$2,$3) ON CONFLICT(child_id) DO UPDATE SET parent_id=$2,kind=$3",
        [
          p!.id,
          d.parentId,
          ["duet", "stitch"].includes(d.template) ? d.template : "template",
        ],
      );
    return {
      id: p!.id,
      message: d.publish ? "Your post is published" : "Draft saved",
    };
  }
  if (action === "follow") {
    const d = z.object({ id: uuid, follow: z.boolean() }).parse(raw);
    need(d.id !== u.id, "You cannot follow yourself");
    need(!(await blocked(db, u.id, d.id)), "This account is unavailable", 403);
    need(
      await one(
        db,
        "SELECT 1 FROM identity.user_account WHERE id=$1 AND state='active'",
        [d.id],
      ),
      "Account unavailable",
    );
    if (d.follow)
      await db.query(
        "INSERT INTO content.follow(follower_id,followee_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [u.id, d.id],
      );
    else
      await db.query(
        "DELETE FROM content.follow WHERE follower_id=$1 AND followee_id=$2",
        [u.id, d.id],
      );
    return { message: d.follow ? "Following creator" : "Unfollowed creator" };
  }
  if (action === "like") {
    const d = z.object({ id: uuid, liked: z.boolean() }).parse(raw);
    await visiblePost(db, u, d.id);
    if (d.liked)
      await db.query(
        "INSERT INTO content.reaction(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [d.id, u.id],
      );
    else
      await db.query(
        "DELETE FROM content.reaction WHERE post_id=$1 AND user_id=$2",
        [d.id, u.id],
      );
    await db.query(
      "UPDATE content.post_stats SET likes=(SELECT count(*) FROM content.reaction WHERE post_id=$1) WHERE post_id=$1",
      [d.id],
    );
    return { ok: true };
  }
  if (action === "watch") {
    const d = z
      .object({
        id: uuid,
        ms: z.number().int().min(0).max(600000),
        completed: z.boolean(),
      })
      .parse(raw);
    const p = await visiblePost(db, u, d.id);
    if (p.author_id === u.id) return { ok: true };
    const old = await one(
      db,
      "SELECT * FROM content.watch WHERE post_id=$1 AND user_id=$2",
      [d.id, u.id],
    );
    if (!old) {
      await db.query(
        "INSERT INTO content.watch(post_id,user_id,watch_ms,completed) VALUES($1,$2,$3,$4)",
        [d.id, u.id, d.ms, d.completed],
      );
      await db.query(
        "UPDATE content.audition SET served_impressions=served_impressions+1,state=CASE WHEN served_impressions+1>=guaranteed_impressions THEN 'complete'::content.audition_state ELSE 'running'::content.audition_state END WHERE post_id=$1",
        [d.id],
      );
    } else
      await db.query(
        "UPDATE content.watch SET watch_ms=greatest(watch_ms,$3),completed=completed OR $4 WHERE post_id=$1 AND user_id=$2",
        [d.id, u.id, d.ms, d.completed],
      );
    await db.query(
      `UPDATE content.post_stats SET plays=(SELECT count(*) FROM content.watch WHERE post_id=$1),impressions=(SELECT count(*) FROM content.watch WHERE post_id=$1),watch_ms_total=(SELECT coalesce(sum(watch_ms),0) FROM content.watch WHERE post_id=$1),completions=(SELECT count(*) FROM content.watch WHERE post_id=$1 AND completed) WHERE post_id=$1`,
      [d.id],
    );
    return { ok: true };
  }
  if (action === "comment") {
    const d = z.object({ id: uuid, body: text }).parse(raw);
    const p = await visiblePost(db, u, d.id);
    const setting = await one(
      db,
      "SELECT comment_filter FROM trust.nirapod_setting WHERE user_id=$1",
      [p.author_id],
    );
    if (setting?.comment_filter !== "off")
      need(
        !/(kill yourself|মরে যা|toke marbo|মেরে ফেলব)/iu.test(d.body),
        "This comment was blocked by Nirapod. Please use respectful language.",
      );
    await db.query(
      "INSERT INTO content.comment(post_id,user_id,body) VALUES($1,$2,$3)",
      [d.id, u.id, d.body],
    );
    await db.query(
      "UPDATE content.post_stats SET comments=comments+1 WHERE post_id=$1",
      [d.id],
    );
    return { message: "Comment posted" };
  }
  if (action === "pin-comment") {
    const d = z.object({ id: uuid }).parse(raw);
    const c = await one(
      db,
      "SELECT c.* FROM content.comment c JOIN content.post p ON p.id=c.post_id WHERE c.id=$1 AND p.author_id=$2",
      [d.id, u.id],
    );
    need(c, "Only the post author can pin a comment", 403);
    await db.query("UPDATE content.comment SET pinned=NOT pinned WHERE id=$1", [
      d.id,
    ]);
    return { message: "Comment pin updated" };
  }
  if (action === "message") {
    const d = z
      .object({ id: uuid, body: z.string().trim().min(1).max(2000) })
      .parse(raw);
    need(
      d.id !== u.id && !(await blocked(db, u.id, d.id)),
      "You cannot message this person",
      403,
    );
    const s = await one(
      db,
      "SELECT dm_from FROM trust.nirapod_setting WHERE user_id=$1",
      [d.id],
    );
    need(
      s?.dm_from === "everyone" ||
        (s?.dm_from === "following" &&
          (await one(
            db,
            "SELECT 1 FROM content.follow WHERE follower_id=$1 AND followee_id=$2",
            [d.id, u.id],
          ))),
      "This person does not accept messages from you",
      403,
    );
    await db.query(
      "INSERT INTO app.message(sender_id,recipient_id,body) VALUES($1,$2,$3)",
      [u.id, d.id, d.body],
    );
    await notify(
      db,
      d.id,
      "New message",
      `${u.display_name} sent you a message`,
    );
    return { message: "Message sent" };
  }
  if (action === "read-notifications") {
    await db.query(
      "UPDATE app.notification SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
      [u.id],
    );
    return { ok: true };
  }
  if (action === "report") {
    const d = z
      .object({
        id: uuid,
        reason: z.enum([
          "spam",
          "harassment",
          "hate_speech",
          "minor_safety",
          "fraud",
          "copyright",
          "communal_religious",
        ]),
        note: z.string().max(1000).default(""),
        block: z.boolean(),
      })
      .parse(raw);
    const p = await visiblePost(db, u, d.id);
    need(p.author_id !== u.id, "You cannot report yourself");
    await db.query(
      "INSERT INTO trust.report(reporter_id,post_id,subject_id,category,note) VALUES($1,$2,$3,$4,$5)",
      [u.id, d.id, p.author_id, d.reason, d.note],
    );
    await db.query(
      `INSERT INTO trust.moderation_case(post_id,subject_id,category,severity,requires_human) VALUES($1,$2,$3,$4,true)`,
      [
        d.id,
        p.author_id,
        d.reason,
        ["minor_safety", "communal_religious"].includes(d.reason)
          ? "critical"
          : "medium",
      ],
    );
    if (d.block)
      await db.query(
        "INSERT INTO app.block(user_id,target_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [u.id, p.author_id],
      );
    return {
      message: d.block
        ? "Reported and blocked. Their content is hidden."
        : "Report sent to the safety team",
    };
  }
  if (action === "unblock") {
    const id = uuid.parse(raw.id);
    await db.query("DELETE FROM app.block WHERE user_id=$1 AND target_id=$2", [
      u.id,
      id,
    ]);
    return { message: "Account unblocked" };
  }
  if (action === "appeal") {
    const d = z.object({ id: uuid, statement: text }).parse(raw);
    const c = await one(
      db,
      "SELECT * FROM trust.moderation_case WHERE id=$1 AND subject_id=$2 AND state='actioned'",
      [d.id, u.id],
    );
    need(c, "This decision cannot be appealed", 403);
    await db.query(
      "INSERT INTO trust.appeal(case_id,submitted_by,statement) VALUES($1,$2,$3)",
      [d.id, u.id, d.statement],
    );
    await db.query(
      "UPDATE trust.moderation_case SET state='appealed' WHERE id=$1",
      [d.id],
    );
    return { message: "Appeal submitted for review" };
  }
  if (action === "academy") {
    const lesson = z
      .enum([
        "first-post",
        "safe-community",
        "first-sale",
        "understand-earnings",
      ])
      .parse(raw.lesson);
    await db.query(
      "INSERT INTO app.academy_progress(user_id,lesson) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [u.id, lesson],
    );
    return { message: "Lesson completed" };
  }
  return undefined;
}
