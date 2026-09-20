// CHEESEAnal — position count with an honest in-range breakdown on hover.
import type { LpProviderRow } from '@/lib/lpPools';
import { tokenPrice } from './format';

interface Props {
  row: LpProviderRow;
  /** Paired token symbol, for the price range labels. */
  symbol: string;
  /** CHEESE price in the paired token at this snapshot. */
  poolPrice?: number;
}

/**
 * Shows `2 (1 in range)` with a hover detail listing each position's recorded
 * price range and the pool price at that snapshot. Older snapshots carry no
 * ranges, so the hover detail simply says so.
 */
export function InRangeCell({ row, symbol, poolPrice }: Props) {
  const ranges = row.ranges ?? [];

  const title = ranges.length
    ? [
        poolPrice && poolPrice > 0 ? `Pool price: ${tokenPrice(poolPrice, symbol)}` : null,
        ...ranges.map((r, i) => {
          const where =
            r.full === 1
              ? 'full range'
              : r.lo !== undefined && r.hi !== undefined
                ? `${tokenPrice(r.lo, symbol)} – ${tokenPrice(r.hi, symbol)}`
                : 'range not recorded';
          return `Position ${i + 1}: ${where} · ${r.in === 1 ? 'in range' : 'out of range'}`;
        }),
      ]
        .filter(Boolean)
        .join('\n')
    : 'Price ranges were not recorded in this snapshot.';

  return (
    <span title={title} className="cursor-help">
      {row.pos}{' '}
      <span className={`text-[10px] ${row.inRange === 0 && row.pos > 0 ? 'text-muted-foreground' : ''}`}>
        ({row.inRange} in range)
      </span>
    </span>
  );
}
