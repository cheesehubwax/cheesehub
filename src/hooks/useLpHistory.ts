// CHEESELytics — readers for the recorded LP history and the live pool state.
import { useQuery } from '@tanstack/react-query';
import { fetchLiveLpSnapshot } from '@/lib/lpLive';
import type { LpDayFile, LpIndexFile, LpIndexDay } from '@/lib/lpPools';

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
    queryKey: ['cheeseLytics', 'index'],
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
    queryKey: ['cheeseLytics', 'day', date],
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
    queryKey: ['cheeseLytics', 'live'],
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
