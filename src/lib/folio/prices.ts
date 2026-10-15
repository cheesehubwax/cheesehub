// Daily token prices recorded by .github/workflows/token-price-history.yml.
// Shared public data (no user data): one small file per UTC day.
import { mapLimit } from '../chainRequest';
import type { PriceAt, TokenKey } from './types';
import { WAX_KEY } from './types';

export interface PriceDay {
  date: string; // YYYY-MM-DD
  /** USD per 1 WAX that day (0 when unknown). */
  waxUsd: number;
  /** WAX per 1 token, keyed `contract:SYMBOL`. */
  prices: Record<TokenKey, number>;
}

const DEFAULT_OWNER = 'cheesehubwax';
const REPO = 'cheesehub';
const BRANCH = 'token-price-data';

function baseUrl(): string {
  const override = import.meta.env.VITE_TOKEN_PRICE_BASE_URL as string | undefined;
  if (override) return override.replace(/\/$/, '');
  let owner = DEFAULT_OWNER;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
    owner = window.location.hostname.replace('.github.io', '');
  }
  return `https://raw.githubusercontent.com/${owner}/${REPO}/${BRANCH}/data`;
}

const dayCache = new Map<string, Promise<PriceDay | null>>();

export async function fetchPriceIndex(): Promise<string[]> {
  const bucket = Math.floor(Date.now() / 600_000);
  try {
    const res = await fetch(`${baseUrl()}/index.json?t=${bucket}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as { dates?: string[] };
    return Array.isArray(data.dates) ? [...data.dates].sort() : [];
  } catch {
    return [];
  }
}

export function fetchPriceDay(date: string): Promise<PriceDay | null> {
  let p = dayCache.get(date);
  if (!p) {
    p = fetch(`${baseUrl()}/days/${date}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<PriceDay>) : null))
      .catch(() => null);
    dayCache.set(date, p);
  }
  return p;
}

export const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/** Latest recorded date on or before `date`, at most `maxBackDays` earlier. */
export function nearestDate(dates: string[], date: string, maxBackDays = 3): string | null {
  let lo = 0, hi = dates.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (best < 0) return null;
  const gap = (Date.parse(date) - Date.parse(dates[best])) / 86_400_000;
  return gap <= maxBackDays ? dates[best] : null;
}

/** Loads the days needed for `timestamps` and returns a lookup over them. */
export async function loadPriceLookup(timestamps: number[]): Promise<{ priceAt: PriceAt; days: Map<string, PriceDay>; dates: string[] }> {
  const dates = await fetchPriceIndex();
  const wanted = new Set<string>();
  for (const ts of timestamps) {
    const d = nearestDate(dates, dayOf(ts));
    if (d) wanted.add(d);
  }
  const days = new Map<string, PriceDay>();
  await mapLimit([...wanted], 6, async (d) => {
    const day = await fetchPriceDay(d);
    if (day) days.set(d, day);
  });
  const priceAt: PriceAt = (key, ts) => {
    if (key === WAX_KEY) return 1;
    const d = nearestDate(dates, dayOf(ts));
    const px = d ? days.get(d)?.prices?.[key] : undefined;
    return px && px > 0 ? px : null;
  };
  return { priceAt, days, dates };
}
