/**
 * Historical CHEESE pricing for RAM records, from the consolidated
 * cheese-usd-history.json (Alcor CHEESE/WAX pool daily closes, from 2024-01-28).
 * A record takes the CHEESE price of its own UTC day; days without one stay null.
 */
export const CHEESE_HISTORY_URL =
  process.env.CHEESE_HISTORY_URL ??
  "https://raw.githubusercontent.com/cheesehubwax/cheesehub/token-price-data/data/cheese-usd-history.json";

export type CheeseDays = Map<string, number>;

export async function loadCheeseDays(): Promise<CheeseDays> {
  const res = await fetch(`${CHEESE_HISTORY_URL}?t=${Date.now()}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`CHEESE history unavailable (${res.status})`);
  const map = (await res.json()) as Record<string, { wax?: number }>;
  const out: CheeseDays = new Map();
  for (const [day, v] of Object.entries(map)) if (Number(v?.wax) > 0) out.set(day, Number(v.wax));
  return out;
}

/** Same rounding as sample.ts. Returns null when that day has no CHEESE price. */
export function cheeseFields(days: CheeseDays, t: number, waxPerKb: number) {
  const waxPerCheese = days.get(new Date(t).toISOString().slice(0, 10));
  if (!(waxPerCheese && waxPerCheese > 0) || !(waxPerKb > 0)) return null;
  return {
    cheesePerKb: Number((waxPerKb / waxPerCheese).toFixed(4)),
    waxPerCheese: Number(waxPerCheese.toFixed(8)),
  };
}
