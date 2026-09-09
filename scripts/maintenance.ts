try {
  process.loadEnvFile(".env.local");
} catch {}
const { pool, tx, one, audit } = await import("../lib/db");
const { clearDue } = await import("../lib/creator");
const { lockCommand } = await import("../lib/locks");
const result = await tx(async (db) => {
  const operator = await one(
    db,
    "SELECT * FROM identity.user_account WHERE 'admin'=ANY(roles) AND state='active' ORDER BY id LIMIT 1",
  );
  if (!operator) throw new Error("An active operations account is required");
  await lockCommand(
    db,
    operator as import("../lib/auth").User,
    "admin-clear",
    {},
  );
  const cleared = await clearDue(db);
  const otp = await db.query("DELETE FROM app.otp WHERE expires_at<now()");
  const sessions = await db.query(
    "DELETE FROM app.session WHERE expires_at<now()",
  );
  const rates = await db.query(
    "DELETE FROM app.rate_limit WHERE resets_at<now()",
  );
  const signals = await db.query(
    "DELETE FROM live.signal WHERE created_at<now()-interval '1 hour'",
  );
  const receipts = await db.query(
    "DELETE FROM app.command WHERE action IN ('watch','signal','like','preference','read-notifications') AND created_at<now()-interval '30 days'",
  );
  // Financial and unclassified legacy receipts and all journals remain intact.
  const trial = await one(db, "SELECT * FROM ledger.trial_balance");
  if (trial!.drift_paisa !== 0)
    throw new Error("Ledger drift detected; pause payouts and investigate");
  const removed = {
    otp: otp.rowCount,
    sessions: sessions.rowCount,
    rates: rates.rowCount,
    signals: signals.rowCount,
    nonfinancialReceipts: receipts.rowCount,
  };
  await audit(db, operator.id, "maintenance", undefined, { cleared, removed });
  return { cleared, removed, ...trial };
});
console.log(JSON.stringify(result, null, 2));
await pool.end();

export {};
