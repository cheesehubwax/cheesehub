// CHEESEAnal — history charts and provider list for one selected pool.
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { CheeseLogo, PairLabel, PairLogos, UsdLogo } from '@/components/anal/PairLogos';
import { HistoricalNote } from '@/components/anal/HistoricalNote';
import { MiniChartTooltip } from '@/components/anal/MiniChartTooltip';
import { diffPoolSnapshots, waxUsdFromPools } from '@/components/anal/snapshotDiff';
import { TokenLogo } from '@/components/TokenLogo';
import { VenueLabel } from '@/components/anal/VenueLogo';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useLpDay } from '@/hooks/useLpHistory';
import { downloadPoolHistoryCsv } from '@/lib/lpCsv';
import { type LpDayFile, type LpIndexDay, type LpPoolSnapshot, type LpTokenConfig } from '@/lib/lpPools';
import { amount, change, shortDate, tokenPrice, tooltipDate, usd } from './format';

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

  const chartHover = {
    onMouseMove: (state: { activeLabel?: string | number }) =>
      setHovered(state?.activeLabel != null ? String(state.activeLabel) : null),
    onMouseLeave: () => setHovered(null),
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
          <div className="space-y-1">
            <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <TokenLogo contract={pool.contract ?? ''} symbol={pool.symbol} size="sm" />
                {token.symbol} price in {pool.symbol}
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">
                {pool.priceInPaired ? tokenPrice(pool.priceInPaired, pool.symbol) : '—'}
              </div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...chartHover}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => tokenPrice(v)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={(props) => <MiniChartTooltip {...props} format={(v) => tokenPrice(v, pool.symbol)} valueClass="text-cheese" extras={extras('price')} />} />
                  <Line type="monotone" dataKey="price" stroke="#FACC15" strokeWidth={2} dot={{ r: 3, fill: '#FACC15', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <UsdLogo />
                Pool value (USD)
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">{usd(pool.usd)}</div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...chartHover}>
                  <defs>
                    <linearGradient id="analPoolUsd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => usd(v)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={(props) => <MiniChartTooltip {...props} format={usd} valueClass="text-cheese" extras={extras('usd')} />} />
                  <Area type="monotone" dataKey="usd" stroke="#3B82F6" strokeWidth={2} fill="url(#analPoolUsd)" dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <CheeseLogo base={token} />
                {token.symbol} in pool
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">{amount(pool.cheese, 0)}</div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...chartHover}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => amount(v, 0)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={(props) => <MiniChartTooltip {...props} format={(v) => `${amount(v, 4)} ${token.symbol}`} valueClass="text-cheese" extras={extras('cheese')} />} />
                  <Line type="monotone" dataKey="cheese" stroke="#22C55E" strokeWidth={2} dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <TokenLogo contract={pool.contract ?? ''} symbol={pool.symbol} size="sm" />
                {pool.symbol} in pool
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">{amount(pool.paired, 4)}</div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...chartHover}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => amount(v, 2)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={(props) => <MiniChartTooltip {...props} format={(v) => `${amount(v, 6)} ${pool.symbol}`} valueClass="text-foreground" extras={extras('paired')} />} />
                  <Line type="monotone" dataKey="paired" stroke="#EC4899" strokeWidth={2} dot={{ r: 3, fill: '#EC4899', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Provider accounts
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">{`${pool.accounts} (${pool.positions} pos)`}</div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...chartHover}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} allowDecimals={false} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={(props) => <MiniChartTooltip {...props} format={(v) => `${Math.round(v)} accounts`} valueClass="text-foreground" extras={extras('accounts')} />} />
                  <Line type="monotone" dataKey="accounts" stroke="#FFFFFF" strokeWidth={2} dot={{ r: 3, fill: '#FFFFFF', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <UsdLogo />
                Volume (24h)
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">
                {latestVolume?.volumeUsd !== null && latestVolume?.volumeUsd !== undefined
                  ? usd(latestVolume.volumeUsd)
                  : '—'}
              </div>
            </div>
            {volumeSeries.length > 0 ? (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...chartHover}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                    <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => usd(v)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                    <Tooltip content={(props) => <MiniChartTooltip {...props} format={usd} valueClass="text-cheese" extras={extras('volumeUsd')} />} />
                    <Line type="monotone" dataKey="volumeUsd" stroke="#38BDF8" strokeWidth={2} connectNulls={false} dot={{ r: 3, fill: '#38BDF8', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center text-center text-[11px] text-muted-foreground px-4">
                Volume history starts with the next daily snapshot.
              </div>
            )}
          </div>
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
                    {row.pos} <span className="text-[10px]">({row.inRange} in range)</span>
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
