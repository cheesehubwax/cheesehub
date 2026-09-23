// CHEESEAnal — history charts and provider list for one selected pool.
import { useMemo, useState } from 'react';
import { AnalChartCard } from '@/components/anal/AnalChartCard';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { CheeseLogo, PairLabel, PairLogos, UsdLogo } from '@/components/anal/PairLogos';
import { HistoricalNote } from '@/components/anal/HistoricalNote';
import { InRangeCell } from '@/components/anal/InRangeCell';
import { diffPoolSnapshots, waxUsdFromPools } from '@/components/anal/snapshotDiff';
import { TokenLogo } from '@/components/TokenLogo';
import { VenueLabel } from '@/components/anal/VenueLogo';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useLpDay } from '@/hooks/useLpHistory';
import { downloadPoolHistoryCsv } from '@/lib/lpCsv';
import { type LpDayFile, type LpIndexDay, type LpPoolSnapshot, type LpTokenConfig } from '@/lib/lpPools';
import { amount, change, tokenPrice, tooltipDate, usd } from './format';

interface AnalPoolDetailProps {
  pool: LpPoolSnapshot | null;
  /** All pools visible for the current venue, in table order. */
  pools: LpPoolSnapshot[];
  /** Recorded days trimmed to the selected range. */
  days: LpIndexDay[];
  current: LpDayFile | null;
  onSelectAccount: (account: string) => void;
  onSelectPool: (key: string) => void;
  /** Base token of the open tab. */
  token: LpTokenConfig;
}

const axisTick = { fontSize: 10, fill: '#FFFFFF' } as const;
const MAX_NAMES = 4;

function nameList(names: string[]): string {
  if (names.length <= MAX_NAMES) return names.join(', ');
  return `${names.slice(0, MAX_NAMES).join(', ')} +${names.length - MAX_NAMES} more`;
}

export function AnalPoolDetail({ pool, pools, days, current, onSelectAccount, onSelectPool, token }: AnalPoolDetailProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const series = useMemo(() => {
    if (!pool) return [];
    return days
      .map((day) => {
        const row = day.pools.find((p) => p.key === pool.key);
        return row
          ? {
              date: day.date,
              usd: row.usd,
              cheese: row.cheese,
              paired: row.paired,
              accounts: row.accounts,
               positions: row.positions,
              // This pair's own CHEESE price, in the paired token.
              price: row.priceInPaired ?? 0,
              // USD volume is recorded once per UTC day, so gaps are expected.
              volumeUsd: row.volumeUsd24 ?? null,
               waxUsd: waxUsdFromPools(day.pools),
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [days, pool]);

  const sortedPools = useMemo(
    () => [...pools].sort((a, b) => b.usd - a.usd),
    [pools],
  );

  const hasSeries = series.length >= 1;
  const volumeSeries = series.filter((row): row is typeof row & { volumeUsd: number } => row.volumeUsd !== null);
  const latestVolume = volumeSeries[volumeSeries.length - 1] ?? null;
  const hoveredIndex = hovered ? series.findIndex((row) => row.date === hovered) : -1;
  const previousDate = hoveredIndex > 0 ? series[hoveredIndex - 1].date : null;
  const { day: hoveredDay, isLoading: hoveredLoading } = useLpDay(hovered, token.key);
  const { day: previousDay, isLoading: previousLoading } = useLpDay(previousDate, token.key);
  const poolDiff = useMemo(
    () => (pool && hovered ? diffPoolSnapshots(hoveredDay, previousDay, pool.key) : null),
    [pool, hovered, hoveredDay, previousDay],
  );

  const previousValue = (date: string, key: 'price' | 'usd' | 'cheese' | 'paired' | 'accounts' | 'volumeUsd') => {
    const index = series.findIndex((row) => row.date === date);
    for (let i = index - 1; i >= 0; i -= 1) {
      const candidate = series[i][key];
      if (candidate !== null && candidate !== undefined) return Number(candidate);
    }
    return null;
  };

  const extras = (key: 'price' | 'usd' | 'cheese' | 'paired' | 'accounts' | 'volumeUsd') =>
    (date: string, value: number): string[] => {
      const lines: string[] = [];
      const index = series.findIndex((row) => row.date === date);
      const previous = previousValue(date, key);
      const pct = previous !== null ? change(value, previous) : null;
      if (pct) lines.push(`${pct.text} since last snapshot`);
      else if (index === 0) lines.push('first recorded snapshot');

      if (key === 'usd') {
        const waxUsd = series[index]?.waxUsd;
        if (waxUsd && waxUsd > 0) lines.push(`${amount(value / waxUsd, 0)} WAX`);
      }
      if (key === 'accounts') {
        const previousPositions = index > 0 ? series[index - 1].positions : null;
        const currentPositions = series[index]?.positions;
        if (previous !== null) lines.push(`${value - previous >= 0 ? '+' : ''}${Math.round(value - previous)} accounts`);
        if (previousPositions !== null && currentPositions !== undefined) {
          const delta = currentPositions - previousPositions;
          lines.push(`${delta >= 0 ? '+' : ''}${delta} positions`);
        }
        if (index > 0 && (hoveredLoading || previousLoading)) {
          lines.push('loading accounts...');
        } else if (poolDiff) {
          if (poolDiff.joined.length) lines.push(`joined: ${nameList(poolDiff.joined)}`);
          if (poolDiff.left.length) lines.push(`left: ${nameList(poolDiff.left)}`);
          const moves = poolDiff.positionChanges.filter(
            (move) => !poolDiff.joined.includes(move.account) && !poolDiff.left.includes(move.account),
          );
          if (moves.length) {
            lines.push(...moves.slice(0, MAX_NAMES).map((move) => `${move.account} ${move.delta > 0 ? '+' : ''}${move.delta} positions`));
            if (moves.length > MAX_NAMES) lines.push(`+${moves.length - MAX_NAMES} more accounts`);
          }
          if (!poolDiff.joined.length && !poolDiff.left.length && !moves.length) lines.push('no provider changes');
        }
      }
      return lines;
    };


  if (!pool) {
    return (
      <div className="w-full rounded-xl bg-card border border-border/50 p-6 text-center text-xs text-muted-foreground">
        Select a pool above to see its history and providers.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-card border border-border/50 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select value={pool.key} onValueChange={onSelectPool} disabled={sortedPools.length === 0}>
          <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-1.5 pr-2 rounded-md gap-2 shadow-none hover:bg-background/50 focus:ring-0 focus:ring-offset-0 [&>svg]:text-muted-foreground">
            <OpenMojiIcon emoji="🔍" size={18} />
            <span className="text-sm font-medium text-foreground">
              <PairLabel symbol={pool.symbol} contract={pool.contract} base={token} size="md" />
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border/60 bg-background/60 text-muted-foreground">
              <VenueLabel venue={pool.venue} />
            </span>
          </SelectTrigger>
          <SelectContent>
            {sortedPools.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                <span className="inline-flex items-center gap-2">
                  <PairLogos symbol={p.symbol} contract={p.contract} base={token} size="sm" />
                  <span className="text-foreground">{token.symbol} / {p.symbol}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border/60 bg-background/60 text-muted-foreground">
                    <VenueLabel venue={p.venue} />
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <HistoricalNote token={token} />
        <Button
          size="sm"
          variant="outline"
          disabled={series.length === 0}
          onClick={() => downloadPoolHistoryCsv(days, pool.key, pool.label)}
        >
          Pool history CSV
        </Button>
      </div>

      {hasSeries ? (
        <div className="grid gap-4 md:grid-cols-2">
          <AnalChartCard
            title={`${token.symbol} price in ${pool.symbol}`}
            label={
              <>
                <TokenLogo contract={pool.contract ?? ''} symbol={pool.symbol} size="sm" />
                {token.symbol} price in {pool.symbol}
              </>
            }
            value={pool.priceInPaired ? tokenPrice(pool.priceInPaired, pool.symbol) : '—'}
            data={series}
            dataKey="price"
            type="line"
            color="#FACC15"
            format={(v) => tokenPrice(v, pool.symbol)}
            yFormat={(v) => tokenPrice(v)}
            valueClass="text-cheese"
            extras={extras('price')}
            onHover={setHovered}
          />

          <AnalChartCard
            title="Pool value (USD)"
            label={
              <>
                <UsdLogo />
                Pool value (USD)
              </>
            }
            value={usd(pool.usd)}
            data={series}
            dataKey="usd"
            type="area"
            gradientId="analPoolUsd"
            color="#3B82F6"
            format={usd}
            yFormat={(v) => usd(v)}
            valueClass="text-cheese"
            extras={extras('usd')}
            onHover={setHovered}
          />

          <AnalChartCard
            title={`${token.symbol} in pool`}
            label={
              <>
                <CheeseLogo base={token} />
                {token.symbol} in pool
              </>
            }
            value={amount(pool.cheese, 0)}
            data={series}
            dataKey="cheese"
            type="line"
            color="#22C55E"
            format={(v) => `${amount(v, 4)} ${token.symbol}`}
            yFormat={(v) => amount(v, 0)}
            valueClass="text-cheese"
            extras={extras('cheese')}
            onHover={setHovered}
          />

          <AnalChartCard
            title={`${pool.symbol} in pool`}
            label={
              <>
                <TokenLogo contract={pool.contract ?? ''} symbol={pool.symbol} size="sm" />
                {pool.symbol} in pool
              </>
            }
            value={amount(pool.paired, 4)}
            data={series}
            dataKey="paired"
            type="line"
            color="#EC4899"
            format={(v) => `${amount(v, 6)} ${pool.symbol}`}
            yFormat={(v) => amount(v, 2)}
            valueClass="text-foreground"
            extras={extras('paired')}
            onHover={setHovered}
          />

          <AnalChartCard
            title="Provider accounts"
            label="Provider accounts"
            value={`${pool.accounts} (${pool.positions} pos)`}
            data={series}
            dataKey="accounts"
            type="line"
            color="#FFFFFF"
            format={(v) => `${Math.round(v)} accounts`}
            valueClass="text-foreground"
            allowDecimals={false}
            extras={extras('accounts')}
            onHover={setHovered}
          />

          {volumeSeries.length > 0 ? (
            <AnalChartCard
              title="Volume (24h)"
              label={
                <>
                  <UsdLogo />
                  Volume (24h)
                </>
              }
              value={
                latestVolume?.volumeUsd !== null && latestVolume?.volumeUsd !== undefined
                  ? usd(latestVolume.volumeUsd)
                  : '—'
              }
              data={volumeSeries}
              dataKey="volumeUsd"
              type="line"
              color="#38BDF8"
              format={usd}
              yFormat={(v) => usd(v)}
              valueClass="text-cheese"
              connectNulls={false}
              extras={extras('volumeUsd')}
              onHover={setHovered}
            />
          ) : (
            <div className="space-y-1">
              <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <UsdLogo />
                  Volume (24h)
                </div>
                <div className="text-sm font-mono font-semibold text-foreground leading-tight">—</div>
              </div>
              <div className="h-36 flex items-center justify-center text-center text-[11px] text-muted-foreground px-4">
                Volume history starts with the next daily snapshot.
              </div>
            </div>
          )}
        </div>

      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          Charts appear once a snapshot has been recorded.
        </p>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
          Providers {current?.date ? `· ${tooltipDate(current.date)}` : ''}
        </div>
        {(pool.rangeMismatch ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground mb-2">
            {pool.rangeMismatch} position{pool.rangeMismatch === 1 ? '' : 's'} here had the exchange reporting a
            different in-range state than the recorded price range shows. The price range is used.
          </p>
        )}
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-muted-foreground text-[10px] uppercase tracking-wide">
                <th className="text-left font-medium py-2">#</th>
                <th className="text-left font-medium py-2">Account</th>
                <th className="text-right font-medium py-2">
                  <span className="inline-flex items-center justify-end gap-1"><UsdLogo />USD</span>
                </th>
                <th className="text-right font-medium py-2">
                  <span className="inline-flex items-center justify-end gap-1"><CheeseLogo base={token} />{token.symbol}</span>
                </th>
                <th className="text-right font-medium py-2">
                  <span className="inline-flex items-center justify-end gap-1">
                    <TokenLogo contract={pool.contract ?? ''} symbol={pool.symbol} size="sm" />
                    {pool.symbol}
                  </span>
                </th>
                <th className="text-right font-medium py-2">Positions</th>
              </tr>
            </thead>
            <tbody>
              {pool.providers.map((row, i) => (
                <tr
                  key={row.a}
                  onClick={() => onSelectAccount(row.a)}
                  className="border-t border-border/40 cursor-pointer hover:bg-background/50"
                >
                  <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 font-mono text-foreground">{row.a}</td>
                  <td className="py-1.5 text-right font-mono text-cheese">{usd(row.usd)}</td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">{amount(row.cheese, 2)}</td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">{amount(row.paired, 4)}</td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">
                    <InRangeCell row={row} symbol={pool.symbol} poolPrice={pool.priceInPaired} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
