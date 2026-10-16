import { useQuery } from '@tanstack/react-query';

/** One recorded RAM price sample (see scripts/ram-price-history). */
export interface RamHistoryRecord {
  /** Sample time, epoch ms. */
  t: number;
  /** WAX per KB of RAM. */
  waxPerKb: number;
  /** CHEESE per KB of RAM. Null on records backfilled from chain history. */
  cheesePerKb: number | null;
  /** WAX per 1 CHEESE at sample time. Null on backfilled records. */
  waxPerCheese: number | null;
  /** USD per KB of RAM. Null when no WAX/USD rate exists for that day. */
  usdPerKb: number | null;
}

export type RamHistoryRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export const RAM_HISTORY_RANGES: { key: RamHistoryRange; label: string; ms: number | null }[] = [
  { key: '24h', label: '24H', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30D', ms: 30 * 24 * 60 * 60 * 1000 },
  { key: '90d', label: '90D', ms: 90 * 24 * 60 * 60 * 1000 },
  { key: '1y', label: '1Y', ms: 365 * 24 * 60 * 60 * 1000 },
  { key: 'all', label: 'ALL', ms: null },
];

/** GitHub Pages serves from <owner>.github.io, so the owner is derivable at runtime. */
const DEFAULT_OWNER = 'cheesehubwax';
const DEFAULT_REPO = 'cheesehub';
const DATA_BRANCH = 'ram-price-data';
const DATA_PATH = 'data/ram-price-history.json';

function historyUrl(): string {
  const override = import.meta.env.VITE_RAM_HISTORY_URL as string | undefined;
  if (override) return override;

  let owner = DEFAULT_OWNER;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.github.io')) owner = host.replace('.github.io', '');
  }
  return `https://raw.githubusercontent.com/${owner}/${DEFAULT_REPO}/${DATA_BRANCH}/${DATA_PATH}`;
}

async function fetchRamPriceHistory(): Promise<RamHistoryRecord[]> {
  // Bucket the cache-buster per 10 minutes so the CDN copy is still reused.
  const bucket = Math.floor(Date.now() / 600_000);
  const response = await fetch(`${historyUrl()}?t=${bucket}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`RAM price history unavailable (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('RAM price history has an unexpected shape');
  return (data as RamHistoryRecord[])
    .filter((r) => r && Number.isFinite(r.t) && Number(r.waxPerKb) > 0)
    .sort((a, b) => a.t - b.t);
}

/** Reduce a series to at most `max` evenly spaced points, always keeping the last one. */
export function downsample<T>(points: T[], max = 120): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max - 1; i++) out.push(points[Math.round(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

/** Slice recorded history to a range and downsample it for smooth rendering. */
export function sliceRange(
  records: RamHistoryRecord[],
  range: RamHistoryRange,
): RamHistoryRecord[] {
  const config = RAM_HISTORY_RANGES.find((r) => r.key === range);
  const windowed =
    config?.ms == null ? records : records.filter((r) => r.t >= Date.now() - config.ms);
  return downsample(windowed);
}

/** RAM price history: twice-daily samples, backfilled from on-chain rammarket state. */
export function useRamPriceHistory() {
  const query = useQuery({
    queryKey: ['cheeseRam', 'priceHistory'],
    queryFn: fetchRamPriceHistory,
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: 1,
  });

  const records = query.data ?? [];
  return {
    records,
    firstSampleAt: records.length ? records[0].t : null,
    /** First live sample (has a CHEESE price); earlier points are backfilled. */
    firstLiveAt: records.find((r) => r.cheesePerKb != null)?.t ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
