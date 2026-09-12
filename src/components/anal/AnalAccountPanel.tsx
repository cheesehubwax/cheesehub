// CHEESEAnal — drill-down into one account's liquidity across every tracked pool.
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { VenueLabel } from '@/components/anal/VenueLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLpAccountHistory } from '@/hooks/useLpHistory';
import { downloadAccountHistoryCsv } from '@/lib/lpCsv';
import { LP_VENUE_LABELS, type LpDayFile } from '@/lib/lpPools';
import { amount, shortDate, tooltipDate, usd } from './format';

interface AnalAccountPanelProps {
  account: string | null;
  onAccountChange: (account: string | null) => void;
  /** UTC dates of the recorded days in the selected range, oldest first. */
  dates: string[];
  current: LpDayFile | null;
}

const axisTick = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } as const;

export function AnalAccountPanel({ account, onAccountChange, dates, current }: AnalAccountPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const { rows, isLoading } = useLpAccountHistory(account, dates);

  // Always start from the full account overview when the account changes.
  useEffect(() => {
    setSelectedPool(null);
  }, [account]);

  /** Today's holdings per pool, from the live/latest snapshot. */
  const holdings = useMemo(() => {
    if (!account || !current) return [];
    return current.pools
      .map((pool) => {
        const row = pool.providers.find((p) => p.a === account);
        return row
          ? { key: pool.key, venue: pool.venue, label: pool.label, symbol: pool.symbol, ...row }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.usd - a.usd);
  }, [account, current]);

  const totalNow = holdings.reduce((sum, h) => sum + h.usd, 0);
  const cheeseNow = holdings.reduce((sum, h) => sum + h.cheese, 0);

  const selectAccount = (name: string | null) => {
    setSelectedPool(null);
    onAccountChange(name);
  };

  /** Rows limited to the selected pool (or all rows when nothing is selected). */
  const chartRows = useMemo(
    () => (selectedPool ? rows.filter((r) => r.poolKey === selectedPool) : rows),
    [rows, selectedPool],
  );

  const selectedPoolLabel = useMemo(() => {
    if (!selectedPool) return null;
    const hit =
      holdings.find((h) => h.key === selectedPool) ?? rows.find((r) => r.poolKey === selectedPool) ?? null;
    if (!hit) return selectedPool;
    const venue = LP_VENUE_LABELS[hit.venue] ?? hit.venue;
    return venue ? `${hit.label} · ${venue}` : hit.label;
  }, [holdings, rows, selectedPool]);

  const series = useMemo(() => {
    const byDate = new Map<string, { date: string; usd: number; cheese: number }>();
    for (const row of chartRows) {
      const entry = byDate.get(row.date) ?? { date: row.date, usd: 0, cheese: 0 };
      entry.usd += row.usd;
      entry.cheese += row.cheese;
      byDate.set(row.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [chartRows]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = query.trim().toLowerCase();
    if (name) selectAccount(name);
  };

  const tooltip = (formatter: (value: number) => string, className: string) =>
    ({ active, payload }: { active?: boolean; payload?: { value?: unknown; payload?: { date: string } }[] }) =>
      active && payload?.length ? (
        <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono">
          <div className={className}>{formatter(Number(payload[0].value))}</div>
          <div className="text-muted-foreground">{tooltipDate(String(payload[0].payload?.date ?? ''))}</div>
        </div>
      ) : null;

  return (
    <div className="w-full rounded-xl bg-card border border-border/50 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <OpenMojiIcon emoji="👤" size={18} />
          <span className="text-sm font-medium text-foreground">Account detail</span>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="wax account name"
            className="h-8 w-44 text-xs font-mono"
          />
          <Button type="submit" size="sm" variant="outline">
            Look up
          </Button>
          {account && (
            <Button type="button" size="sm" variant="ghost" onClick={() => selectAccount(null)}>
              Clear
            </Button>
          )}
        </form>
      </div>

      {!account ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Pick a provider from the list above, or type an account name to see its liquidity history.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-cheese">{account}</span>
            <span className="text-xs text-muted-foreground">
              {usd(totalNow)} across {holdings.length} pool{holdings.length === 1 ? '' : 's'} · {amount(cheeseNow, 2)} CHEESE
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={chartRows.length === 0}
              onClick={() =>
                downloadAccountHistoryCsv(
                  account,
                  chartRows.map((r) => ({
                    date: r.date,
                    venue: r.venue,
                    pool: r.label,
                    symbol: r.symbol,
                    usd: r.usd,
                    cheese: r.cheese,
                    paired: r.paired,
                    positions: r.positions,
                  })),
                  selectedPool ?? undefined,
                )
              }
            >
              {selectedPool ? 'Pool history CSV' : 'Account history CSV'}
            </Button>
          </div>

          {holdings.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">Click a pool to filter the charts below to just that pool.</p>
                {selectedPool && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-cheese hover:text-cheese hover:bg-cheese/10"
                    onClick={() => setSelectedPool(null)}
                  >
                    Show all pools
                  </Button>
                )}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    <th className="text-left font-medium py-2">Pool</th>
                    <th className="text-left font-medium py-2">Venue</th>
                    <th className="text-right font-medium py-2">USD</th>
                    <th className="text-right font-medium py-2">CHEESE</th>
                    <th className="text-right font-medium py-2">Paired</th>
                    <th className="text-right font-medium py-2">Positions</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((row) => (
                    <tr
                      key={row.key}
                      onClick={() => setSelectedPool(selectedPool === row.key ? null : row.key)}
                      title={selectedPool === row.key ? 'Show all pools' : 'Show only this pool'}
                      className={`border-t border-border/40 cursor-pointer transition-colors ${
                        selectedPool === row.key ? 'bg-cheese/10' : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="py-1.5 text-foreground whitespace-nowrap">
                        <span className="text-cheese">CHEESE</span> / {row.symbol}
                      </td>
                      <td className="py-1.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border/60 bg-background/60 text-muted-foreground">
                          <VenueLabel venue={row.venue} />
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono text-foreground">{usd(row.usd)}</td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">{amount(row.cheese, 2)}</td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">
                        {amount(row.paired, 4)} {row.symbol}
                      </td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">
                        {row.pos} <span className="text-[10px]">({row.inRange} in range)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {series.length >= 1 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  Showing: {selectedPoolLabel ?? 'All pools'}
                </span>
                {selectedPool && (
                  <button
                    type="button"
                    onClick={() => setSelectedPool(null)}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cheese/15 text-cheese border border-cheese/30 hover:bg-cheese/25 transition-colors"
                  >
                    All pools ×
                  </button>
                )}
              </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Position value (USD){selectedPoolLabel ? ` — ${selectedPoolLabel}` : ''}
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="analAccountUsd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                      <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => usd(v)} tick={axisTick} width={60} stroke="hsl(var(--border))" />
                      <Tooltip content={tooltip((v) => usd(v), 'text-cheese')} />
                      <Area type="monotone" dataKey="usd" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#analAccountUsd)" dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  CHEESE in positions{selectedPoolLabel ? ` — ${selectedPoolLabel}` : ''}
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                      <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => amount(v, 0)} tick={axisTick} width={60} stroke="hsl(var(--border))" />
                      <Tooltip content={tooltip((v) => `${amount(v, 4)} CHEESE`, 'text-cheese')} />
                      <Line type="monotone" dataKey="cheese" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              {isLoading
                ? 'Loading recorded history for this account...'
                : 'Charts appear once a snapshot has been recorded.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
