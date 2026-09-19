// CHEESEAnal — combined liquidity across every tracked pool of the open token.
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { CheeseLogo, UsdLogo } from '@/components/anal/PairLogos';
import { diffSnapshots, waxUsdFromPools } from '@/components/anal/snapshotDiff';
import { useLpDay } from '@/hooks/useLpHistory';
import type { LpDayFile, LpIndexDay, LpTokenConfig, LpVenue } from '@/lib/lpPools';
import { amount, change, shortDate, tooltipDate, usd, usdPrice } from './format';

interface AnalOverviewProps {
  /** Recorded days already trimmed to the selected range. */
  days: LpIndexDay[];
  /** Latest full workflow snapshot. */
  current: LpDayFile | null;
  historyLoading: boolean;
  historyEmpty: boolean;
  /** Active venue filter, so account diffs match what is on screen. */
  venue: LpVenue | 'all';
  /** Base token of the open tab. */
  token: LpTokenConfig;
}

type MetricKey = 'price' | 'usd' | 'cheese' | 'accounts' | 'positions' | 'volume';

function metricsFor(symbol: string): { key: MetricKey; label: string; color: string; format: (v: number) => string }[] {
  return [
    { key: 'price', label: `${symbol} price`, color: '#FACC15', format: usdPrice },
    { key: 'usd', label: 'Total liquidity', color: '#3B82F6', format: usd },
    { key: 'cheese', label: `${symbol} in pools`, color: '#22C55E', format: (v) => amount(v, 0) },
    { key: 'accounts', label: 'Providers', color: '#FFFFFF', format: (v) => String(Math.round(v)) },
    { key: 'positions', label: 'Positions', color: '#EC4899', format: (v) => String(Math.round(v)) },
    { key: 'volume', label: 'Total volume', color: '#38BDF8', format: usd },
  ];
}

/** Keep tooltip account lists readable. */
const MAX_NAMES = 4;

function nameList(names: string[]): string {
  if (names.length <= MAX_NAMES) return names.join(', ');
  return `${names.slice(0, MAX_NAMES).join(', ')} +${names.length - MAX_NAMES} more`;
}

export function AnalOverview({ days, current, historyLoading, historyEmpty, venue, token }: AnalOverviewProps) {
  const [metric, setMetric] = useState<MetricKey>('price');
  const [hovered, setHovered] = useState<string | null>(null);
  const METRICS = useMemo(() => metricsFor(token.symbol), [token.symbol]);


  const totals = useMemo(() => {
    const pools = current?.pools ?? [];
    const accounts = new Set<string>();
    let value = 0;
    let cheese = 0;
    let positions = 0;
    for (const pool of pools) {
      value += pool.usd;
      cheese += pool.cheese;
      positions += pool.positions;
      for (const row of pool.providers) accounts.add(row.a);
    }
    return {
      value,
      cheese,
      positions,
      accounts: accounts.size,
      pools: pools.length,
      price: current?.cheeseUsd ?? 0,
    };
  }, [current]);

  const series = useMemo(
    () =>
      days.map((day) => {
        const recordedVolumes = day.pools
          .map((pool) => pool.volumeUsd24)
          .filter((value): value is number => value !== undefined);
        return {
          date: day.date,
          price: day.cheeseUsd ?? 0,
          usd: day.pools.reduce((sum, p) => sum + p.usd, 0),
          cheese: day.pools.reduce((sum, p) => sum + p.cheese, 0),
          accounts:
            day.uniqueAccounts ?? day.pools.reduce((sum, p) => sum + p.accounts, 0),
          positions: day.pools.reduce((sum, p) => sum + p.positions, 0),
          volume: recordedVolumes.length > 0
            ? recordedVolumes.reduce((sum, value) => sum + value, 0)
            : null,
          waxUsd: waxUsdFromPools(day.pools),
        };
      }),
    [days],
  );

  const active = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  // Provider / position attribution needs the full snapshot files, pulled only
  // for the hovered point and then cached by react-query.
  const needsAccounts = metric === 'accounts' || metric === 'positions';
  const hoveredIndex = hovered ? series.findIndex((row) => row.date === hovered) : -1;
  const previousDate = hoveredIndex > 0 ? series[hoveredIndex - 1].date : null;
  const { day: hoveredDay, isLoading: hoveredLoading } = useLpDay(
    needsAccounts && hovered ? hovered : null,
    token.key,
  );
  const { day: previousDay, isLoading: previousLoading } = useLpDay(
    needsAccounts && previousDate ? previousDate : null,
    token.key,
  );
  const accountDiff = useMemo(
    () => (needsAccounts ? diffSnapshots(hoveredDay, previousDay, venue) : null),
    [needsAccounts, hoveredDay, previousDay, venue],
  );
  const accountsLoading = needsAccounts && Boolean(previousDate) && (hoveredLoading || previousLoading);

  const comparableValues = series
    .map((row) => row[metric])
    .filter((value): value is number => value !== null);
  const delta =
    comparableValues.length >= 2
      ? change(comparableValues[comparableValues.length - 1], comparableValues[comparableValues.length - 2])
      : null;

  const recordedVolume = series
    .map((row) => row.volume)
    .filter((value): value is number => value !== null);
  const totalVolume = recordedVolume.reduce((sum, value) => sum + value, 0);
  const chartSeries = metric === 'volume'
    ? series.filter((row): row is typeof row & { volume: number } => row.volume !== null)
    : series;

  const statValues: Record<MetricKey, string> = {
    price: usdPrice(totals.price),
    usd: usd(totals.value),
    cheese: amount(totals.cheese, 0),
    accounts: String(totals.accounts),
    positions: String(totals.positions),
    volume: recordedVolume.length > 0 ? usd(totalVolume) : '—',
  };

  /** Extra tooltip lines for the hovered snapshot. */
  const tooltipExtras = (date: string, value: number): string[] => {
    const lines: string[] = [];
    const index = series.findIndex((row) => row.date === date);
    if (index < 0) return lines;

    if (metric === 'usd') {
      const waxUsd = series[index].waxUsd;
      if (waxUsd && waxUsd > 0) lines.push(`${amount(value / waxUsd, 0)} WAX`);
    }

    if (metric === 'price' || metric === 'cheese' || metric === 'volume') {
      // Compare against the previous snapshot that actually recorded this metric.
      let previous: number | null = null;
      for (let i = index - 1; i >= 0; i -= 1) {
        const candidate = series[i][metric];
        if (candidate !== null && candidate !== undefined) {
          previous = candidate as number;
          break;
        }
      }
      const pct = previous !== null ? change(value, previous) : null;
      if (pct) lines.push(`${pct.text} since last snapshot`);
    }

    if (needsAccounts) {
      const previous = index > 0 ? series[index - 1][metric] : null;
      const diffCount = previous !== null ? Math.round(value) - Math.round(previous as number) : null;
      if (diffCount !== null) {
        lines.push(`${diffCount > 0 ? '+' : ''}${diffCount} since last snapshot`);
      }
      if (index === 0) {
        lines.push('first recorded snapshot');
      } else if (accountsLoading) {
        lines.push('loading accounts...');
      } else if (accountDiff) {
        if (metric === 'accounts') {
          if (accountDiff.joined.length) lines.push(`joined: ${nameList(accountDiff.joined)}`);
          if (accountDiff.left.length) lines.push(`left: ${nameList(accountDiff.left)}`);
          if (!accountDiff.joined.length && !accountDiff.left.length) lines.push('no provider changes');
        } else {
          const moves = accountDiff.positionChanges;
          if (moves.length) {
            lines.push(
              ...moves
                .slice(0, MAX_NAMES)
                .map((m) => `${m.account} ${m.delta > 0 ? '+' : ''}${m.delta}`),
            );
            if (moves.length > MAX_NAMES) lines.push(`+${moves.length - MAX_NAMES} more accounts`);
          } else {
            lines.push('no position changes');
          }
        }
      }
    }

    return lines;
  };

  return (
    <div className="w-full rounded-xl bg-card border border-border/50 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <OpenMojiIcon emoji="📊" size={18} />
          <span className="text-sm font-medium text-foreground">{token.symbol} Overview</span>
        </div>
        {delta && (
          <span className={`text-xs font-mono ${delta.up ? 'text-green-400' : 'text-red-400'}`}>
            {delta.text} vs previous day
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-8">
        {METRICS.map((stat) => {
          const selected = metric === stat.key;
          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => setMetric(stat.key)}
              aria-pressed={selected}
              className="rounded-lg border border-border/50 px-2 py-1.5 text-center transition-colors flex flex-col items-center justify-center whitespace-nowrap"
              style={
                selected
                  ? {
                      backgroundColor: `${stat.color}33`,
                      borderColor: `${stat.color}99`,
                      boxShadow: `0 0 0 1px ${stat.color}66`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-white/80">
                {stat.key === 'price' ? <CheeseLogo base={token} /> : null}
                {stat.key === 'usd' ? <UsdLogo /> : null}
                {stat.key === 'cheese' ? <CheeseLogo base={token} /> : null}
                {stat.key === 'volume' ? <UsdLogo /> : null}
                {stat.label}
              </div>
              <div className="text-sm font-mono font-semibold text-white leading-tight">
                {statValues[stat.key]}
              </div>
            </button>
          );
        })}
      </div>

      {series.length >= 1 ? (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartSeries}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                onMouseMove={(state: { activeLabel?: string | number }) =>
                  setHovered(state?.activeLabel != null ? String(state.activeLabel) : null)
                }
                onMouseLeave={() => setHovered(null)}
              >
              <defs>
                <linearGradient id="analTotalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={active.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={active.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 10, fill: '#FFFFFF' }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => active.format(v)}
                tick={{ fontSize: 10, fill: '#FFFFFF' }}
                stroke="hsl(var(--border))"
                width={64}
              />
              <Tooltip
                content={({ active: isActive, payload }) => {
                  if (!isActive || !payload?.length) return null;
                  const value = Number(payload[0].value);
                  const date = String(payload[0].payload.date);
                  return (
                    <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono max-w-[260px]">
                      <div className="text-cheese">{active.format(value)}</div>
                      {tooltipExtras(date, value).map((line) => (
                        <div key={line} className="text-white/90 break-words">
                          {line}
                        </div>
                      ))}
                      <div className="text-muted-foreground">{tooltipDate(date)}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={active.color}
                strokeWidth={2}
                fill="url(#analTotalGradient)"
                dot={{ r: 3, fill: active.color, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-24 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
          {historyLoading
            ? 'Loading recorded history...'
            : historyEmpty
              ? 'No snapshots recorded yet — figures appear after the first workflow run.'
              : 'Collecting history from the twice-daily workflow snapshots.'}
        </div>
      )}
    </div>
  );
}
