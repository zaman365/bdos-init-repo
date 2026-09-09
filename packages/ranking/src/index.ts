/**
 * BDOS feed ranking.
 *
 * Two rules here are product promises, not tuning knobs, so they are enforced
 * structurally rather than by score weight:
 *
 *   1. The audition contract (docs/03 §4). Every post is owed a guaranteed
 *      number of impressions. A score bonus does NOT deliver that — a strong
 *      established post simply outscores it — so auditioning posts get a
 *      reserved share of feed slots instead.
 *   2. Author diversity. One creator must not own a session, however well
 *      they perform.
 *
 * Everything else — completion rate, likes, report penalty, recency decay — is
 * ordinary scoring and can be retuned freely.
 */

export const aliases: Record<string, string> = {
  kacchi: 'কাচ্চি', biriyani: 'বিরিয়ানি', jamdani: 'জামদানি', kurti: 'কুর্তি',
  shapla: 'শাপলা', dhaka: 'ঢাকা', skincare: 'স্কিনকেয়ার', beauty: 'বিউটি',
};

/**
 * Expand a query across scripts. People type "kacchi" and "কাচ্চি" for the
 * same thing and both must return the same results (docs/05 §5).
 */
export function searchTerms(q: string): string[] {
  const n = q.trim().toLowerCase().slice(0, 100);
  return [...new Set([
    n,
    ...Object.entries(aliases).flatMap(([latin, bangla]) =>
      n.includes(latin) ? [n.replaceAll(latin, bangla)]
      : n.includes(bangla) ? [n.replaceAll(bangla, latin)]
      : []),
  ])];
}

export interface Candidate {
  id: string;
  author_id: string;
  plays: number;
  completions: number;
  likes: number;
  reports: number;
  served_impressions: number;
  guaranteed_impressions: number;
  published_at: string | Date;
}

/** Recency lift decays to nothing over three days. */
const RECENCY_WINDOW_MS = 3 * 24 * 3_600_000;

/**
 * One slot in every four is reserved for posts still owed their audition.
 * This is the number that makes the cold-start contract real: at 25%, a new
 * post reaches an audience even when every rival is more popular.
 */
export const AUDITION_SLOT_EVERY = 4;

/** True while a post still has audition impressions owed to it. */
export function isAuditioning(p: Candidate): boolean {
  return p.served_impressions < p.guaranteed_impressions;
}

export function score(p: Candidate, now: number): number {
  const completionRate = (p.completions + 1) / (p.plays + 5);
  const age = now - new Date(p.published_at).getTime();
  return completionRate * 4
    + Math.log1p(p.likes) * 0.15
    - Math.log1p(p.reports) * 0.6
    + Math.max(0, 1 - age / RECENCY_WINDOW_MS);
}

/**
 * Pull the next post, spacing authors out.
 *
 * Naively "take the best post whose author differs from the last two" looks
 * right and is wrong: it spends the scarce authors early, then has nothing
 * left but the prolific one and emits it in a long run at the tail. So the
 * choice is count-first — among authors that are not the previous slot's,
 * prefer the one with the most posts still queued, and let score decide within
 * an author and between authors holding equal counts.
 *
 * The trade-off is deliberate. "One creator must not own the feed" is a stated
 * product rule, so author balance outranks score here; score still orders
 * everything it can. When spacing is arithmetically impossible — one author
 * holding most of the pool — this degrades to emitting them consecutively
 * rather than dropping posts.
 */
function takeSpaced<T extends Candidate>(queue: T[], emitted: T[], now: number): T | undefined {
  if (queue.length === 0) return undefined;

  const remaining = new Map<string, number>();
  for (const c of queue) remaining.set(c.author_id, (remaining.get(c.author_id) ?? 0) + 1);

  const previous = emitted.length ? emitted[emitted.length - 1].author_id : null;
  const eligible = previous === null ? queue : queue.filter((c) => c.author_id !== previous);
  const pool = eligible.length ? eligible : queue;

  let best = pool[0];
  for (const c of pool) {
    const bestCount = remaining.get(best.author_id)!;
    const count = remaining.get(c.author_id)!;
    if (count > bestCount || (count === bestCount && score(c, now) > score(best, now))) best = c;
  }
  queue.splice(queue.indexOf(best), 1);
  return best;
}

export function rank<T extends Candidate>(items: T[], now = Date.now()): T[] {
  const byScore = (a: T, b: T) => score(b, now) - score(a, now) || a.id.localeCompare(b.id);

  // Two queues, so the reserved slots cannot be starved by high scores.
  const auditioning = items.filter(isAuditioning).sort(byScore);
  const established = items.filter((p) => !isAuditioning(p)).sort(byScore);

  const out: T[] = [];
  while (auditioning.length || established.length) {
    const slot = out.length + 1;
    const auditionSlot = slot % AUDITION_SLOT_EVERY === 1;

    // On a reserved slot prefer an auditioning post; otherwise prefer an
    // established one. Either queue falls back to the other when empty, so no
    // post is ever left unranked.
    const first = auditionSlot ? auditioning : established;
    const second = auditionSlot ? established : auditioning;
    const next = takeSpaced(first, out, now) ?? takeSpaced(second, out, now);
    if (!next) break;
    out.push(next);
  }
  return out;
}
