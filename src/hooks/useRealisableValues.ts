// What selling each whole holding for WAX would return right now, from a live
// Alcor route quote (pool depth and fees included). Paper value is
// amount × spot price; the gap shows how much a full sale would lose to depth.
import { useQuery } from '@tanstack/react-query';
import { mapLimit } from '@/lib/chainRequest';
import { fetchSwapRoute } from '@/lib/swapApi';
import { realisableGapPct } from '@/lib/folio/holdings';
import type { HoldingRow } from '@/lib/folio/holdings';
import { WAX_KEY } from '@/lib/folio/types';

export interface Realisable {
  /** WAX a full sale returns now; null when no route exists. */
  wax: number | null;
  /** Realisable vs paper value, in %. Negative = sale returns less. */
  gapPct: number | null;
}

const WAX_TOKEN = { contract: 'eosio.token', ticker: 'WAX', precision: 8 };
/** Holdings worth less than this (WAX, paper) are not quoted. */
const MIN_WAX = 1;
const MAX_QUOTES = 40;

export function useRealisableValues(rows: HoldingRow[], account: string | null) {
  const targets = rows
    .filter((r) => r.key !== WAX_KEY && (r.valueWax ?? 0) >= MIN_WAX)
    .slice(0, MAX_QUOTES);
  const key = targets.map((r) => `${r.key}=${r.balance}`).join('|');
  return useQuery({
    queryKey: ['folio-realisable', account, key],
    enabled: !!account && targets.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const out = new Map<string, Realisable>();
      await mapLimit(targets, 2, async (r) => {
        try {
          const route = await fetchSwapRoute(
            { contract: r.contract, ticker: r.symbol, precision: r.precision },
            WAX_TOKEN, String(r.balance), 1, account!,
          );
          const wax = route && Number.isFinite(route.output) ? route.output : null;
          out.set(r.key, { wax, gapPct: realisableGapPct(wax, r.valueWax) });
        } catch {
          out.set(r.key, { wax: null, gapPct: null });
        }
      });
      return out;
    },
  });
}
