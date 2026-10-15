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

const DAY_MS = 86_400_000;
const BINANCE = ['https://data-api.binance.vision', 'https://api.binance.com'];

/**
 * Daily WAX/USD closes from `fromTs` to today (Binance WAXPUSDT, read in
 * 1,000-day pages). Returns a map of `YYYY-MM-DD` → USD per WAX; empty when
 * no source answers.
 */
export async function fetchWaxUsdDaily(fromTs: number, signal?: AbortSignal): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const host of BINANCE) {
    let start = Math.floor(fromTs / DAY_MS) * DAY_MS;
    let ok = true;
    while (start <= Date.now()) {
      try {
        const res = await fetch(`${host}/api/v3/klines?symbol=WAXPUSDT&interval=1d&startTime=${start}&limit=1000`, { signal });
        if (!res.ok) { ok = false; break; }
        const rows = (await res.json()) as [number, string, string, string, string][];
        if (!Array.isArray(rows) || !rows.length) break;
        for (const r of rows) {
          const close = parseFloat(r[4]);
          if (close > 0) out.set(dayOf(r[0]), close);
        }
        start = rows[rows.length - 1][0] + DAY_MS;
        if (rows.length < 1000) break;
      } catch {
        ok = false;
        break;
      }
    }
    if (ok && out.size) return out;
  }
  return out;
}

/** Lookup over daily WAX/USD rates: the day's close, or the nearest earlier day within 3 days. */
export function waxUsdLookup(daily: Map<string, number>): (ts: number) => number | null {
  const dates = [...daily.keys()].sort();
  return (ts) => {
    const d = nearestDate(dates, dayOf(ts));
    return d ? daily.get(d) ?? null : null;
  };
}
