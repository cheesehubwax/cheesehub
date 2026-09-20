// CHEESEAnal — accounts that once provided real liquidity and have since left.
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { HistoricalNote } from '@/components/anal/HistoricalNote';
import { PairLogos, UsdLogo } from '@/components/anal/PairLogos';
import { VenueLogo } from '@/components/anal/VenueLogo';
import {
  TOMBSTONE_DUST_USD,
  TOMBSTONE_PEAK_USD,
  type LpDepartedProvider,
  type LpTokenConfig,
} from '@/lib/lpPools';
import { tooltipDate, usd } from './format';

interface AnalTombstoneProps {
  rows: LpDepartedProvider[];
  isLoading: boolean;
  isError: boolean;
  /** Base token of the open tab. */
  token: LpTokenConfig;
  onSelectAccount: (account: string) => void;
}

export function AnalTombstone({ rows, isLoading, isError, token, onSelectAccount }: AnalTombstoneProps) {
  return (
    <div className="w-full rounded-xl bg-card border border-border/50 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="flex items-center gap-2">
          <OpenMojiIcon emoji="💀" size={18} />
          <span className="text-sm font-medium text-foreground">Tombstone</span>
          <OpenMojiIcon emoji="💀" size={18} />
        </div>
        <HistoricalNote token={token} />
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Accounts whose recorded {token.symbol} liquidity once passed{' '}
        {usd(TOMBSTONE_PEAK_USD)} and is now gone or worth under {usd(TOMBSTONE_DUST_USD)}. Built
        from every recorded snapshot, so it covers the whole history rather than the selected range.
      </p>

      {isError ? (
        <p className="text-xs text-red-400 py-6 text-center">
          The recorded snapshots could not be read right now, so no departures are shown.
        </p>
      ) : isLoading && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Reading every recorded snapshot...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No providers have left yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-[10px] uppercase tracking-wide">
                <th className="text-left font-medium py-2">Account</th>
                <th className="text-right font-medium py-2">
                  <span className="inline-flex items-center justify-end gap-1"><UsdLogo />Peak value</span>
                </th>
                <th className="text-left font-medium py-2">Peak snapshot</th>
                <th className="text-left font-medium py-2">Pools</th>
                <th className="text-left font-medium py-2">Last seen</th>
                <th className="text-right font-medium py-2">Now</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.account} className="border-t border-border/30">
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onSelectAccount(row.account)}
                      className="font-mono text-primary hover:underline"
                    >
                      {row.account}
                    </button>
                  </td>
                  <td className="py-2 text-right text-foreground">{usd(row.peakUsd)}</td>
                  <td className="py-2 text-muted-foreground">{tooltipDate(row.peakDate)}</td>
                  <td className="py-2">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.pools.map((pool) => (
                        <span key={pool.key} className="inline-flex items-center gap-1 text-muted-foreground">
                          <PairLogos symbol={pool.symbol} contract={pool.contract} base={token} />
                          <span>
                            <span className="text-cheese">{token.symbol}</span> / {pool.symbol}
                          </span>
                          <VenueLogo venue={pool.venue} />
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{tooltipDate(row.lastActiveDate)}</td>
                  <td className="py-2 text-right text-muted-foreground">{usd(row.currentUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
