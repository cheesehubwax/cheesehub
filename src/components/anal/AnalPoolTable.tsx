// CHEESELytics — one row per tracked CHEESE pool with day-over-day change.
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import type { LpDayFile, LpIndexDay } from '@/lib/lpPools';
import { amount, change, usd } from './format';

interface LyticsPoolTableProps {
  current: LpDayFile | null;
  /** Recorded days, oldest first — used only for the change column. */
  days: LpIndexDay[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  failed: string[];
  isLoading: boolean;
}

export function LyticsPoolTable({
  current,
  days,
  selectedKey,
  onSelect,
  failed,
  isLoading,
}: LyticsPoolTableProps) {
  const previous = days.length >= 2 ? days[days.length - 2] : null;
  const pools = [...(current?.pools ?? [])].sort((a, b) => b.usd - a.usd);

  return (
    <div className="w-full rounded-xl bg-card border border-border/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <OpenMojiIcon emoji="💧" size={18} />
        <span className="text-sm font-medium text-foreground">Pools</span>
        <span className="text-[10px] text-muted-foreground">tap a pool for detail</span>
      </div>

      {failed.length > 0 && (
        <p className="mb-2 text-xs text-red-400">
          Could not read {failed.join(', ')} right now — those pools are left out rather than shown as zero.
        </p>
      )}

      {isLoading && pools.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Reading pools...</p>
      ) : pools.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No pool data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-[10px] uppercase tracking-wide">
                <th className="text-left font-medium py-2">Pool</th>
                <th className="text-right font-medium py-2">USD value</th>
                <th className="text-right font-medium py-2">CHEESE</th>
                <th className="text-right font-medium py-2">Paired token</th>
                <th className="text-right font-medium py-2">Accounts</th>
                <th className="text-right font-medium py-2">24h</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => {
                const before = previous?.pools.find((p) => p.key === pool.key);
                const delta = before ? change(pool.usd, before.usd) : null;
                const selected = pool.key === selectedKey;
                return (
                  <tr
                    key={pool.key}
                    onClick={() => onSelect(pool.key)}
                    className={`cursor-pointer border-t border-border/40 transition-colors ${
                      selected ? 'bg-primary/10' : 'hover:bg-background/50'
                    }`}
                  >
                    <td className="py-2 font-medium text-foreground whitespace-nowrap">
                      <span className="text-cheese">CHEESE</span> / {pool.symbol}
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {pool.poolIds.length} tier{pool.poolIds.length === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-foreground">{usd(pool.usd)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{amount(pool.cheese, 0)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">
                      {amount(pool.paired, 4)} {pool.symbol}
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{pool.accounts}</td>
                    <td
                      className={`py-2 text-right font-mono ${
                        delta ? (delta.up ? 'text-green-400' : 'text-red-400') : 'text-muted-foreground'
                      }`}
                    >
                      {delta ? delta.text : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
