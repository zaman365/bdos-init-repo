import { type DB, one, rows, need } from "./db";
import {
  type Entry,
  buildEntry,
  toAccountKind,
} from "../packages/ledger/src/index.ts";
export async function journal(db: DB, input: Entry) {
  const e = buildEntry(input);
  const existing = await one(
    db,
    "SELECT id FROM ledger.journal_entry WHERE idempotency_key=$1",
    [e.idempotencyKey],
  );
  if (existing) return existing.id as string;
  const header = await one(
    db,
    "INSERT INTO ledger.journal_entry(kind,idempotency_key,description,order_id) VALUES($1,$2,$3,$4) RETURNING id",
    [e.kind, e.idempotencyKey, e.description, e.orderId ?? null],
  );
  for (const line of e.lines) {
    const owner = line.account.owner ?? null;
    const kind = toAccountKind(line.account.kind);
    const ownerKind = !owner
      ? "platform"
      : kind === "seller_payable"
        ? "seller"
        : kind === "courier_payable"
          ? "courier"
          : "user";
    await db.query(
      "INSERT INTO ledger.account(kind,owner_kind,owner_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [kind, ownerKind, owner],
    );
    const a = await one(
      db,
      "SELECT id FROM ledger.account WHERE kind=$1 AND owner_id IS NOT DISTINCT FROM $2::uuid",
      [kind, owner],
    );
    await db.query(
      "INSERT INTO ledger.journal_line(entry_id,account_id,amount_paisa,memo) VALUES($1,$2,$3,$4)",
      [header!.id, a!.id, line.amount, line.memo ?? null],
    );
  }
  return header!.id as string;
}
export async function balance(db: DB, kind: string, owner: string) {
  return (
    (
      await one(
        db,
        "SELECT balance_paisa FROM ledger.account_balance WHERE kind=$1 AND owner_id=$2",
        [kind, owner],
      )
    )?.balance_paisa ?? 0
  );
}
export async function reverse(
  db: DB,
  orderId: string,
  kind: string,
  key: string,
) {
  const e = await one(
    db,
    "SELECT id FROM ledger.journal_entry WHERE order_id=$1 AND kind=$2",
    [orderId, kind],
  );
  if (!e) return;
  const lines = await rows(
    db,
    "SELECT a.kind,a.owner_id,l.amount_paisa FROM ledger.journal_line l JOIN ledger.account a ON a.id=l.account_id WHERE entry_id=$1",
    [e.id],
  );
  await journal(db, {
    kind: "manual_correction",
    idempotencyKey: key,
    description: `Reverse ${kind}`,
    orderId,
    lines: lines.map((l) => ({
      account: { kind: toAccountKind(l.kind), owner: l.owner_id ?? undefined },
      amount: -l.amount_paisa,
    })),
  });
}
