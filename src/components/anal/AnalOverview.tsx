// CHEESEAnal — combined liquidity across every tracked CHEESE pool.
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import type { LpDayFile, LpIndexDay } from '@/lib/lpPools';
import { amount, change, shortDate, usd } from './format';

interface AnalOverviewProps {
  /** Recorded days already trimmed to the selected range. */
  days: LpIndexDay[];
  /** Latest state — live from Alcor when available, otherwise the newest day. */
  current: LpDayFile | null;
  historyLoading: boolean;
  historyEmpty: boolean;
}

type MetricKey = 'usd' | 'cheese' | 'accounts' | 'positions';

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: 'usd', label: 'Total liquidity', format: usd },
  { key: 'cheese', label: 'CHEESE in pools', format: (v) => amount(v, 0) },
  { key: 'accounts', label: 'Providers', format: (v) => String(Math.round(v)) },
  { key: 'positions', label: 'Positions', format: (v) => String(Math.round(v)) },
];

export function AnalOverview({ days, current, historyLoading, historyEmpty }: AnalOverviewProps) {
  const [metric, setMetric] = useState<MetricKey>('usd');

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
    return { value, cheese, positions, accounts: accounts.size, pools: pools.length };
  }, [current]);

  const series = useMemo(
    () =>
      days.map((day) => ({
        date: day.date,
        usd: day.pools.reduce((sum, p) => sum + p.usd, 0),
        cheese: day.pools.reduce((sum, p) => sum + p.cheese, 0),
        accounts:
          day.uniqueAccounts ?? day.pools.reduce((sum, p) => sum + p.accounts, 0),
        positions: day.pools.reduce((sum, p) => sum + p.positions, 0),
      })),
    [days],
  );

  const active = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  const delta =
    series.length >= 2
      ? change(series[series.length - 1][metric], series[series.length - 2][metric])
      : null;

  const statValues: Record<MetricKey, string> = {
    usd: usd(totals.value),
    cheese: amount(totals.cheese, 0),
    accounts: String(totals.accounts),
    positions: String(totals.positions),
  };

  return (
    <div className="w-full rounded-xl bg-card border border-border/50 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <OpenMojiIcon emoji="📊" size={18} />
          <span className="text-sm font-medium text-foreground">CHEESE liquidity overview</span>
        </div>
        {delta && (
          <span className={`text-xs font-mono ${delta.up ? 'text-green-400' : 'text-red-400'}`}>
            {delta.text} vs previous day
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {METRICS.map((stat) => {
          const selected = metric === stat.key;
          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => setMetric(stat.key)}
              aria-pressed={selected}
              className={`rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? 'bg-primary/15 border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]'
                  : 'bg-background/40 border-border/40 hover:border-primary/40'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</div>
              <div className="text-lg font-mono font-semibold text-cheese">{statValues[stat.key]}</div>
            </button>
          );
        })}
      </div>

      {series.length >= 1 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="analTotalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => active.format(v)}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--border))"
                width={64}
              />
              <Tooltip
                content={({ active: isActive, payload }) =>
                  isActive && payload?.length ? (
                    <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono">
                      <div className="text-cheese">{active.format(Number(payload[0].value))}</div>
                      <div className="text-muted-foreground">
                        {active.label} · {shortDate(String(payload[0].payload.date))}
                      </div>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#analTotalGradient)"
                dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
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
              ? 'No snapshots recorded yet — the first one lands on the next daily run. Figures above are live.'
              : 'Collecting history — one snapshot is recorded per day.'}
        </div>
      )}
    </div>
  );
}
