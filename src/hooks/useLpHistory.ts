// CHEESEAnal — readers for the recorded LP history and the live pool state.
import { useQuery } from '@tanstack/react-query';
import { fetchLiveLpSnapshot } from '@/lib/lpLive';
import { poolsForVenue, type LpDayFile, type LpIndexFile, type LpIndexDay, type LpVenue } from '@/lib/lpPools';

const DEFAULT_OWNER = 'cheesehubwax';
const DEFAULT_REPO = 'cheesehub';
const DATA_BRANCH = 'lp-history-data';

/** GitHub Pages serves from <owner>.github.io, so the owner is derivable at runtime. */
function dataUrl(path: string): string {
  const override = import.meta.env.VITE_LP_HISTORY_BASE as string | undefined;
  if (override) return `${override.replace(/\/$/, '')}/${path}`;

  let owner = DEFAULT_OWNER;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.github.io')) owner = host.replace('.github.io', '');
  }
  return `https://raw.githubusercontent.com/${owner}/${DEFAULT_REPO}/${DATA_BRANCH}/data/${path}`;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  // Bucket the cache-buster per 10 minutes so the CDN copy is still reused.
  const bucket = Math.floor(Date.now() / 600_000);
  const res = await fetch(`${dataUrl(path)}?t=${bucket}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LP history unavailable (${res.status})`);
  return (await res.json()) as T;
}

export type LpRange = '7d' | '30d' | '90d' | 'all';

export const LP_RANGES: { key: LpRange; label: string; days: number | null }[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'ALL', days: null },
];

/** Trim a recorded series to a range. */
export function sliceDays(days: LpIndexDay[], range: LpRange): LpIndexDay[] {
  const config = LP_RANGES.find((r) => r.key === range);
  if (!config?.days) return days;
  return days.slice(-config.days);
}

/** Pool-level totals per recorded day (small file, always loaded). */
export function useLpHistoryIndex() {
  const query = useQuery({
    queryKey: ['cheeseAnal', 'index'],
    queryFn: async () => (await fetchJson<LpIndexFile>('lp-history-index.json')) ?? null,
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: 1,
  });

  const days = (query.data?.days ?? [])
    .filter((d) => d && typeof d.date === 'string' && Array.isArray(d.pools))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    updatedAt: query.data?.updatedAt ?? null,
    /** No history recorded yet (branch or file missing / empty). */
    isEmpty: !query.isLoading && !query.isError && days.length === 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Full per-account rows for one recorded day. */
export function useLpDay(date: string | null) {
  const query = useQuery({
    queryKey: ['cheeseAnal', 'day', date],
    queryFn: async () => (await fetchJson<LpDayFile>(`days/${date}.json`)) ?? null,
    enabled: Boolean(date),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  return { day: query.data ?? null, isLoading: query.isLoading, isError: query.isError };
}

/** Live pool state read straight from Alcor, for the "today" figures. */
export function useLiveLpSnapshot() {
  const query = useQuery({
    queryKey: ['cheeseAnal', 'live'],
    queryFn: fetchLiveLpSnapshot,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  return {
    snapshot: query.data ?? null,
    failed: query.data?.failed ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** One account's liquidity in one pool on one recorded day. */
export interface LpAccountHistoryRow {
  date: string;
  poolKey: string;
  label: string;
  symbol: string;
  usd: number;
  cheese: number;
  paired: number;
  positions: number;
}

/** Never pull more than this many day files for one account view. */
const MAX_ACCOUNT_DAYS = 90;
const DAY_FETCH_CONCURRENCY = 6;

async function fetchAccountHistory(account: string, dates: string[]): Promise<LpAccountHistoryRow[]> {
  const wanted = dates.slice(-MAX_ACCOUNT_DAYS);
  const rows: LpAccountHistoryRow[] = [];

  for (let i = 0; i < wanted.length; i += DAY_FETCH_CONCURRENCY) {
    const chunk = wanted.slice(i, i + DAY_FETCH_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((date) =>
        fetchJson<LpDayFile>(`days/${date}.json`).catch(() => null),
      ),
    );
    for (const day of results) {
      if (!day || !Array.isArray(day.pools)) continue;
      for (const pool of day.pools) {
        const row = pool.providers?.find((p) => p.a === account);
        if (!row) continue;
        rows.push({
          date: day.date,
          poolKey: pool.key,
          label: pool.label,
          symbol: pool.symbol,
          usd: row.usd,
          cheese: row.cheese,
          paired: row.paired,
          positions: row.pos,
        });
      }
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** Recorded history of one account across every tracked pool. */
export function useLpAccountHistory(account: string | null, dates: string[]) {
  const key = dates.slice(-MAX_ACCOUNT_DAYS).join(',');
  const query = useQuery({
    queryKey: ['cheeseAnal', 'account', account, key],
    queryFn: () => fetchAccountHistory(account as string, dates),
    enabled: Boolean(account) && dates.length > 0,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  return { rows: query.data ?? [], isLoading: query.isLoading, isError: query.isError };
}

