// CHEESEAnal — history charts and provider list for one selected pool.
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { CheeseLogo, PairLabel, UsdLogo } from '@/components/anal/PairLogos';
import { TokenLogo } from '@/components/TokenLogo';
import { VenueLabel } from '@/components/anal/VenueLogo';
import { Button } from '@/components/ui/button';
import { downloadPoolHistoryCsv } from '@/lib/lpCsv';
import { type LpDayFile, type LpIndexDay, type LpPoolSnapshot } from '@/lib/lpPools';
import { amount, shortDate, tokenPrice, tooltipDate, usd } from './format';

interface AnalPoolDetailProps {
  pool: LpPoolSnapshot | null;
  /** Recorded days trimmed to the selected range. */
  days: LpIndexDay[];
  current: LpDayFile | null;
  onSelectAccount: (account: string) => void;
}

const axisTick = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } as const;

export function AnalPoolDetail({ pool, days, current, onSelectAccount }: AnalPoolDetailProps) {
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
              // This pair's own CHEESE price, in the paired token.
              price: row.priceInPaired ?? 0,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [days, pool]);

  if (!pool) {
    return (
      <div className="w-full rounded-xl bg-card border border-border/50 p-6 text-center text-xs text-muted-foreground">
        Select a pool above to see its history and providers.
      </div>
    );
  }

  const hasSeries = series.length >= 1;

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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <OpenMojiIcon emoji="🔍" size={18} />
          <span className="text-sm font-medium text-foreground">
            <PairLabel symbol={pool.symbol} contract={pool.contract} size="md" />
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border/60 bg-background/60 text-muted-foreground">
            <VenueLabel venue={pool.venue} />
          </span>
        </div>
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
                CHEESE price in {pool.symbol}
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">
                {pool.priceInPaired ? tokenPrice(pool.priceInPaired, pool.symbol) : '—'}
              </div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => tokenPrice(v)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={tooltip((v) => tokenPrice(v, pool.symbol), 'text-cheese')} />
                  <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 4 }} />
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
                <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analPoolUsd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => usd(v)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={tooltip((v) => usd(v), 'text-cheese')} />
                  <Area type="monotone" dataKey="usd" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#analPoolUsd)" dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <CheeseLogo />
                CHEESE in pool
              </div>
              <div className="text-sm font-mono font-semibold text-foreground leading-tight">{amount(pool.cheese, 0)}</div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => amount(v, 0)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={tooltip((v) => `${amount(v, 4)} CHEESE`, 'text-cheese')} />
                  <Line type="monotone" dataKey="cheese" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 4 }} />
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
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => amount(v, 2)} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={tooltip((v) => `${amount(v, 6)} ${pool.symbol}`, 'text-foreground')} />
                  <Line type="monotone" dataKey="paired" stroke="#FFFFFF" strokeWidth={2} dot={{ r: 3, fill: '#FFFFFF', strokeWidth: 0 }} activeDot={{ r: 4 }} />
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
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
                  <YAxis domain={['auto', 'auto']} allowDecimals={false} tick={axisTick} width={70} stroke="hsl(var(--border))" />
                  <Tooltip content={tooltip((v) => `${v} accounts`, 'text-foreground')} />
                  <Line type="monotone" dataKey="accounts" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
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
                  <span className="inline-flex items-center justify-end gap-1"><CheeseLogo />CHEESE</span>
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
