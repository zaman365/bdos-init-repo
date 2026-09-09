try {
  process.loadEnvFile(".env.local");
} catch {}
const { pool, tx, one } = await import("../lib/db");
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
  await db.query("DELETE FROM app.otp WHERE expires_at<now()-interval '1 day'");
  await db.query("DELETE FROM app.session WHERE expires_at<now()");
  await db.query(
    "DELETE FROM app.rate_limit WHERE resets_at<now()-interval '1 day'",
  );
  await db.query(
    "DELETE FROM live.signal WHERE created_at<now()-interval '1 hour'",
  );
  // Financial command receipts and journals are deliberately retained indefinitely.
  const trial = await one(db, "SELECT * FROM ledger.trial_balance");
  if (trial!.drift_paisa !== 0)
    throw new Error("Ledger drift detected; pause payouts and investigate");
  return { cleared, ...trial };
});
console.log(JSON.stringify(result, null, 2));
await pool.end();

export {};
