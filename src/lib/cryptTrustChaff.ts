/**
 * Decoy ("chaff") Respect lookups: whenever a real account has to be looked up,
 * one decoy account is looked up alongside it in random order, so an observer of
 * the requests cannot tell which account is actually on screen.
 */

/** Real, long-lived WAX accounts, so decoy queries look like ordinary reads. */
export const DECOY_POOL = [
  'cheeseburger', 'cheesecheese', 'cheesepowerz', 'cheesebannad', 'crypt.cheese',
  'swap.alcor', 'alcordexmain', 'atomicassets', 'atomicmarket',
  'eosio.token', 'eosio.ram', 'eosio.stake', 'eosio.rex', 'eosio.null',
] as const;

export const JITTER_MIN_MS = 150;
export const JITTER_MAX_MS = 400;

/** Pick one decoy that is never the real account; previously seen accounts blend in too. */
export function pickDecoy(real: string, seen: string[] = [], rand: () => number = Math.random): string | null {
  const pool = [...new Set([...DECOY_POOL, ...seen])].filter(a => a && a !== real);
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

export function jitterMs(rand: () => number = Math.random): number {
  return Math.round(JITTER_MIN_MS + rand() * (JITTER_MAX_MS - JITTER_MIN_MS));
}

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
