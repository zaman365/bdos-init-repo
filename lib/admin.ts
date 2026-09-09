import { z } from "zod";
import { type DB, type Row, one, need, notify, requireSandbox } from "./db";
import { type User, role } from "./auth";
import { clearDue } from "./creator";
const uuid = z.string().uuid();
export async function adminCommand(
  db: DB,
  u: User,
  action: string,
  raw: Row,
): Promise<Row | undefined> {
  if (action === "partner-lead") {
    role(u, "partner");
    const d = z
      .object({
        name: z.string().trim().min(2).max(100),
        district: z.string().trim().min(2).max(60),
        phone: z.string().regex(/^\+8801[3-9][0-9]{8}$/),
      })
      .parse(raw);
    await db.query(
      "INSERT INTO app.partner_lead(partner_id,business_name,district,phone) VALUES($1,$2,$3,$4)",
      [u.id, d.name, d.district, d.phone],
    );
    return { message: "Business submitted to the onboarding queue" };
  }
  if (!action.startsWith("admin-")) return undefined;
  role(u, "admin");
  if (action === "admin-flag") {
    const d = z
      .object({
        name: z.enum(["commerce", "live", "ads", "uploads", "payouts"]),
        enabled: z.boolean(),
      })
      .parse(raw);
    await db.query("UPDATE app.flag SET enabled=$2 WHERE name=$1", [
      d.name,
      d.enabled,
    ]);
    return { message: "Feature switch updated" };
  }
  if (action === "admin-clear") {
    const count = await clearDue(db);
    return { message: `Cleared ${count} eligible commissions` };
  }
  if (action === "admin-seller") {
    const d = z.object({ id: uuid, approve: z.boolean() }).parse(raw);
    const s = await one(
      db,
      "UPDATE identity.seller SET state=$2 WHERE id=$1 AND state='pending_review' RETURNING owner_id",
      [d.id, d.approve ? "active" : "draft"],
    );
    need(s, "Seller application unavailable");
    if (d.approve)
      await db.query(
        "UPDATE identity.user_account SET roles=array_append(roles,'seller') WHERE id=$1 AND NOT ('seller'=ANY(roles))",
        [s.owner_id],
      );
    await notify(
      db,
      s.owner_id,
      "Seller review complete",
      d.approve
        ? "Your seller account is approved."
        : "Please revise your seller application.",
    );
    return { message: "Seller review saved" };
  }
  if (action === "admin-kyc") {
    requireSandbox();
    const d = z.object({ id: uuid, approve: z.boolean() }).parse(raw);
    need(
      await one(
        db,
        "UPDATE identity.kyc_record SET state=$2,decided_at=now() WHERE id=$1 AND state='submitted' RETURNING id",
        [d.id, d.approve ? "verified" : "rejected"],
      ),
      "Review unavailable",
    );
    return { message: "Sandbox verification recorded" };
  }
  if (action === "admin-campaign") {
    const d = z.object({ id: uuid, approve: z.boolean() }).parse(raw);
    need(
      await one(
        db,
        "UPDATE ads.campaign SET state=$2 WHERE id=$1 AND state='pending_review' RETURNING id",
        [d.id, d.approve ? "active" : "draft"],
      ),
      "Campaign review unavailable",
    );
    return { message: "Campaign review saved" };
  }
  if (action === "admin-moderate") {
    const d = z
      .object({
        id: uuid,
        decision: z.enum(["remove", "dismiss", "uphold", "overturn"]),
        reasonBn: z.string().trim().min(5).max(1000),
        reasonEn: z.string().trim().min(5).max(1000),
      })
      .parse(raw);
    const c = await one(
      db,
      "SELECT * FROM trust.moderation_case WHERE id=$1 FOR UPDATE",
      [d.id],
    );
    need(c, "Case unavailable", 404);
    const appeal = ["uphold", "overturn"].includes(d.decision);
    need(
      appeal
        ? c.state === "appealed"
        : ["open", "human_review"].includes(c.state),
      "This case was already decided",
      409,
    );
    const remove = ["remove", "uphold"].includes(d.decision);
    const state = appeal
      ? remove
        ? "actioned"
        : "overturned"
      : remove
        ? "actioned"
        : "dismissed";
    await db.query(
      "UPDATE trust.moderation_case SET state=$2,closed_at=now() WHERE id=$1",
      [d.id, state],
    );
    if (c.post_id && remove)
      await db.query("UPDATE content.post SET state='removed' WHERE id=$1", [
        c.post_id,
      ]);
    if (c.post_id && d.decision === "overturn") {
      const other = await one(
        db,
        "SELECT 1 FROM trust.moderation_case WHERE post_id=$1 AND id<>$2 AND state IN ('actioned','appealed')",
        [c.post_id, c.id],
      );
      if (!other)
        await db.query(
          "UPDATE content.post SET state='published' WHERE id=$1",
          [c.post_id],
        );
    }
    await db.query(
      "INSERT INTO trust.moderation_action(case_id,kind,reason_bn,reason_en,actor) VALUES($1,$2,$3,$4,$5)",
      [d.id, remove ? "remove_content" : "none", d.reasonBn, d.reasonEn, u.id],
    );
    if (appeal)
      await db.query(
        "UPDATE trust.appeal SET outcome=$2,decided_at=now() WHERE case_id=$1",
        [d.id, remove ? "upheld" : "overturned"],
      );
    await notify(db, c.subject_id, "Safety review decision", d.reasonBn);
    return { message: "Decision saved with a visible reason" };
  }
  if (action === "admin-lead") {
    const d = z
      .object({
        id: uuid,
        state: z.enum(["contacted", "onboarded", "rejected"]),
      })
      .parse(raw);
    need(
      await one(
        db,
        "UPDATE app.partner_lead SET state=$2 WHERE id=$1 RETURNING id",
        [d.id, d.state],
      ),
      "Lead unavailable",
    );
    return { message: "Partner lead updated" };
  }
  return undefined;
}
