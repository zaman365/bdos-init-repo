// Browser retry receipts contain only a SHA-256 payload fingerprint and UUID,
// never the address, message or other command contents.
export function commandSender(send: (body: unknown) => Promise<any>) {
  const inFlight = new Map<string, Promise<any>>();
  const receipts = new Map<string, string>();
  return async (
    userId: string,
    action: string,
    data: Record<string, unknown>,
  ) => {
    const payload = JSON.stringify({ action, data });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(payload),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const slot = `bdos-command:${userId}:${fingerprint}`;
    const running = inFlight.get(slot);
    if (running) return running;
    let storage: Storage | undefined;
    try {
      storage = sessionStorage;
    } catch {}
    let saved: string | null = null;
    try {
      saved = storage?.getItem(slot) ?? null;
    } catch {}
    const key = receipts.get(slot) ?? saved ?? crypto.randomUUID();
    receipts.set(slot, key);
    try {
      storage?.setItem(slot, key);
    } catch {}
    const clear = () => {
      receipts.delete(slot);
      try {
        storage?.removeItem(slot);
      } catch {}
    };
    const task = (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await send({ action, data, key });
          clear();
          return result;
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (status && status < 500) {
            clear();
            throw error;
          }
          if (attempt >= 1) throw error;
        }
      }
    })();
    inFlight.set(slot, task);
    try {
      return await task;
    } finally {
      inFlight.delete(slot);
    }
  };
}
