// CHEESEFolio presentation pieces.
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TokenLogo } from '@/components/TokenLogo';
import type { FolioEvent, FolioEventType, TokenAmount } from '@/lib/folio/types';
import type { HoldingRow } from '@/lib/folio/holdings';

export const fmt = (v: number, max = 4) =>
  v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? Math.max(max, 6) : max });

export const waxFmt = (v: number | null | undefined) => (v == null ? '—' : `${fmt(v, 2)} WAX`);
export const usdFmt = (wax: number | null | undefined, waxUsd: number) =>
  wax == null || !waxUsd ? '' : `$${(wax * waxUsd).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

const plClass = (v: number | null | undefined) => (v == null ? 'text-muted-foreground' : v >= 0 ? 'text-primary' : 'text-destructive');
const signed = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v, 2)}`;

export const EVENT_LABELS: Record<FolioEventType, string> = {
  trade: 'Trade',
  'order-placed': 'Order placed',
  'order-returned': 'Order returned',
  reward: 'Reward',
  received: 'Received',
  sent: 'Sent',
  nulled: 'Nulled',
  'liquidity-add': 'Added liquidity',
  'liquidity-remove': 'Removed liquidity',
};
const VENUE_LABELS: Record<string, string> = { alcor: 'Alcor', defibox: 'Defibox', taco: 'Taco', 'alcor-orderbook': 'Alcor order book' };

export function SummaryBox({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number | null }) {
  return (
    <div className="flex-1 min-w-[160px] rounded-lg border border-cheese/20 bg-cheese/5 px-4 py-3 text-center">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${tone === undefined ? 'text-foreground' : plClass(tone)}`}>{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function AmountList({ items }: { items: TokenAmount[] }) {
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {items.map((a) => (
        <span key={a.key} className="inline-flex items-center gap-1 whitespace-nowrap">
          <TokenLogo contract={a.contract} symbol={a.symbol} size="sm" />
          {fmt(a.amount, a.precision)} {a.symbol}
        </span>
      ))}
    </span>
  );
}

export function HoldingsTable({ rows, waxUsd, onPick }: { rows: HoldingRow[]; waxUsd: number; onPick: (r: HoldingRow) => void }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/50 bg-card/60">
      <table className="w-full min-w-[860px] text-sm whitespace-nowrap">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border/50">
            <th className="px-3 py-2 text-left">Token</th>
            <th className="px-3 py-2 text-right">Balance</th>
            <th className="px-3 py-2 text-right">Avg cost</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Value</th>
            <th className="px-3 py-2 text-right">Unrealised P/L</th>
            <th className="px-3 py-2 text-right">Realised P/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="cursor-pointer border-b border-border/30 hover:bg-cheese/5" onClick={() => onPick(r)}>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <TokenLogo contract={r.contract} symbol={r.symbol} size="sm" />
                  <span className="font-semibold">{r.symbol}</span>
                  <span className="text-xs text-muted-foreground">{r.contract}</span>
                  {!r.complete ? (
                    <span className="rounded border border-destructive/40 px-1 text-[10px] text-destructive" title="Your saved history doesn't add up to your live balance, so profit/loss is hidden for this token.">
                      history incomplete
                    </span>
                  ) : r.position?.unpricedBuys ? (
                    <span className="rounded border border-cheese/40 px-1 text-[10px] text-cheese" title="Some of this token was acquired without a known WAX value.">
                      partly unpriced
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2 text-right">{fmt(r.balance, r.precision)}</td>
              <td className="px-3 py-2 text-right">{r.avgCostWax == null ? '—' : `${fmt(r.avgCostWax, 6)}`}</td>
              <td className="px-3 py-2 text-right">{r.priceWax == null ? '—' : fmt(r.priceWax, 6)}</td>
              <td className="px-3 py-2 text-right">
                <div>{waxFmt(r.valueWax)}</div>
                <div className="text-xs text-muted-foreground">{usdFmt(r.valueWax, waxUsd)}</div>
              </td>
              <td className={`px-3 py-2 text-right ${plClass(r.unrealizedWax)}`}>
                {r.unrealizedWax == null ? '—' : `${signed(r.unrealizedWax)} WAX`}
                {r.unrealizedPct != null ? <div className="text-xs">{signed(r.unrealizedPct)}%</div> : null}
              </td>
              <td className={`px-3 py-2 text-right ${plClass(r.realizedWax || null)}`}>{r.realizedWax ? `${signed(r.realizedWax)} WAX` : '—'}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No tokens with a balance.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const PAGE = 100;

export function ActivityList({
  events, value, realized, filter,
}: { events: FolioEvent[]; value: Map<string, number>; realized: Map<string, number>; filter?: string }) {
  const [type, setType] = useState<FolioEventType | 'all'>('all');
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(
    () =>
      [...events]
        .filter((e) => type === 'all' || e.type === type)
        .filter((e) => !filter || [...e.in, ...e.out].some((a) => a.key === filter))
        .sort((a, b) => b.ts - a.ts),
    [events, type, filter],
  );
  const types = useMemo(() => [...new Set(events.map((e) => e.type))], [events]);
  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-1">
        {(['all', ...types] as const).map((t) => (
          <Button key={t} size="sm" variant={type === t ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { setType(t); setShown(PAGE); }}>
            {t === 'all' ? 'All' : EVENT_LABELS[t]}
          </Button>
        ))}
      </div>
      <div className="w-full overflow-x-auto rounded-lg border border-border/50 bg-card/60">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="px-3 py-2 text-left">Date (UTC)</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Sent</th>
              <th className="px-3 py-2 text-left">Received</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2 text-right">Realised P/L</th>
              <th className="px-3 py-2 text-right">Tx</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map((e) => {
              const r = realized.get(e.id);
              return (
                <tr key={e.id} className="border-b border-border/30 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(e.ts).toISOString().slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{EVENT_LABELS[e.type]}</div>
                    <div className="text-xs text-muted-foreground">{e.venue ? VENUE_LABELS[e.venue] : e.counterparty}</div>
                  </td>
                  <td className="px-3 py-2"><AmountList items={e.out} /></td>
                  <td className="px-3 py-2"><AmountList items={e.in} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{value.has(e.id) ? waxFmt(value.get(e.id)) : '—'}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${plClass(r)}`}>{r == null ? '—' : `${signed(r)} WAX`}</td>
                  <td className="px-3 py-2 text-right">
                    <a className="text-cheese hover:underline" href={`https://waxblock.io/transaction/${e.trx}`} target="_blank" rel="noopener noreferrer">
                      {e.trx.slice(0, 8)}
                    </a>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nothing here yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {list.length > shown ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShown((s) => s + PAGE)}>Show more ({list.length - shown} left)</Button>
        </div>
      ) : null}
    </div>
  );
}

export function PlChart({ data, title }: { data: { date: string; value: number }[]; title: string }) {
  if (data.length < 2) {
    return <div className="flex h-48 items-center justify-center rounded-lg border border-border/50 bg-card/60 text-sm text-muted-foreground">Not enough history for a chart yet.</div>;
  }
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-3">
      <div className="mb-2 text-center text-sm font-semibold">{title}</div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`folio-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} minTickGap={24} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} width={70} tickFormatter={(v: number) => fmt(v, 0)} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              formatter={(v: number) => [`${fmt(v, 2)} WAX`, title]}
            />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill={`url(#folio-${title})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TokenDialog({
  row, events, value, realized, waxUsd, onClose,
}: {
  row: HoldingRow | null; events: FolioEvent[]; value: Map<string, number>; realized: Map<string, number>; waxUsd: number; onClose: () => void;
}) {
  const p = row?.position;
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TokenLogo contract={row.contract} symbol={row.symbol} size="md" />
                {row.symbol} <span className="text-sm font-normal text-muted-foreground">{row.contract}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <SummaryBox label="Balance" value={fmt(row.balance, row.precision)} sub={usdFmt(row.valueWax, waxUsd)} />
              <SummaryBox label="Avg cost" value={row.avgCostWax == null ? '—' : `${fmt(row.avgCostWax, 6)} WAX`} />
              <SummaryBox label="Unrealised" value={row.unrealizedWax == null ? '—' : `${signed(row.unrealizedWax)} WAX`} tone={row.unrealizedWax} />
              <SummaryBox label="Realised" value={`${signed(row.realizedWax)} WAX`} tone={row.realizedWax} />
            </div>
            {p ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-3">
                <div>Bought: <span className="text-foreground">{fmt(p.boughtQty, p.precision)}</span></div>
                <div>Sold: <span className="text-foreground">{fmt(p.soldQty, p.precision)}</span></div>
                <div>Free (rewards, airdrops, received): <span className="text-foreground">{fmt(p.freeQty, p.precision)}</span></div>
                <div>On order: <span className="text-foreground">{fmt(p.onOrderQty, p.precision)}</span></div>
                <div>In liquidity (at cost): <span className="text-foreground">{fmt(p.inLiquidityQty, p.precision)}</span></div>
                <div>History total: <span className="text-foreground">{fmt(p.qty, p.precision)}</span></div>
              </div>
            ) : null}
            {!row.complete ? (
              <p className="text-sm text-destructive">
                Your saved history adds up to a different balance than your wallet shows, so profit/loss for this token is hidden.
                This usually means some history wasn't available — try "Rescan from scratch".
              </p>
            ) : null}
            <ActivityList events={events} value={value} realized={realized} filter={row.key} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
