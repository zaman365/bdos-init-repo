import pg, { type PoolClient } from "pg";
import { createHash } from "node:crypto";
export type DB = Pick<PoolClient, "query">;
export type Row = Record<string, any>;
// All persisted money is capped by input schemas, and bigint outputs must remain exact.
pg.types.setTypeParser(20, (v) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n))
    throw new Error("Database integer exceeds safe range");
  return n;
});
pg.types.setTypeParser(1700, Number);
const g = globalThis as typeof globalThis & { bdosPool?: pg.Pool };
export const pool = (g.bdosPool ??= new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
  idle_in_transaction_session_timeout: 30000,
}));
export async function rows(
  db: DB,
  sql: string,
  args: unknown[] = [],
): Promise<Row[]> {
  return (await db.query(sql, args)).rows;
}
export async function one(
  db: DB,
  sql: string,
  args: unknown[] = [],
): Promise<Row | undefined> {
  return (await rows(db, sql, args))[0];
}
export async function tx<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const r = await fn(db);
    await db.query("COMMIT");
    return r;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function need(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new AppError(message, status);
}
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const sandbox = () => process.env.BDOS_SANDBOX === "true";
export function requireSandbox() {
  need(
    sandbox(),
    "This provider is not configured. Enable the explicit sandbox for local testing.",
    503,
  );
}
export async function audit(
  db: DB,
  userId: string,
  action: string,
  subject?: string,
  detail: Row = {},
) {
  await db.query(
    "INSERT INTO app.audit(actor_id,action,subject,detail) VALUES($1,$2,$3,$4)",
    [userId, action, subject, JSON.stringify(detail)],
  );
}
export async function notify(
  db: DB,
  userId: string,
  title: string,
  body: string,
) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `notify:${userId}`,
  ]);
  await db.query(
    `INSERT INTO app.notification(user_id,title,body) SELECT $1,$2,$3 WHERE (SELECT count(*) FROM app.notification WHERE user_id=$1 AND created_at>=current_date)<10`,
    [userId, title, body],
  );
}
export async function flag(db: DB, name: string) {
  need(
    (await one(db, "SELECT enabled FROM app.flag WHERE name=$1", [name]))
      ?.enabled,
    `${name} is temporarily paused`,
    503,
  );
}
export async function rate(
  db: DB,
  key: string,
  limit: number,
  seconds: number,
) {
  const r = await one(
    db,
    `INSERT INTO app.rate_limit(key,hits,resets_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN app.rate_limit.resets_at<now() THEN 1 ELSE app.rate_limit.hits+1 END,resets_at=CASE WHEN app.rate_limit.resets_at<now() THEN now()+$2*interval '1 second' ELSE app.rate_limit.resets_at END RETURNING hits`,
    [key, seconds],
  );
  need(r!.hits <= limit, "Too many requests. Please try again later.", 429);
}
