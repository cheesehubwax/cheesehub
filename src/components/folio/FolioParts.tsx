// CHEESEFolio presentation pieces.
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TokenLogo } from '@/components/TokenLogo';
import type { FolioEvent, FolioEventType, TokenAmount } from '@/lib/folio/types';
import type { HoldingRow } from '@/lib/folio/holdings';
import type { Realisable } from '@/hooks/useRealisableValues';

export type Currency = 'WAX' | 'USD';

export const fmt = (v: number, max = 4) =>
  v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? Math.max(max, 6) : max });

export const waxFmt = (v: number | null | undefined) => (v == null ? '—' : `${fmt(v, 2)} WAX`);
export const usdFmt = (wax: number | null | undefined, waxUsd: number) =>
  wax == null || !waxUsd ? '' : `$${(wax * waxUsd).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

/** An amount already in `cur`. */
export const money = (v: number | null | undefined, cur: Currency) =>
  v == null ? '—' : cur === 'USD'
    ? `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
    : `${fmt(v, 2)} WAX`;
const signedMoney = (v: number, cur: Currency) => `${v >= 0 ? '+' : ''}${money(v, cur)}`;

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

/** Cumulative receipts, not an estimate of the source of today's balance. */
export function acquisitionBreakdown(key: string, events: FolioEvent[], freeQty: number) {
  const purchased = events.reduce((sum, e) => e.type === 'trade'
    ? sum + e.in.reduce((n, a) => n + (a.key === key ? a.amount : 0), 0)
    : sum, 0);
  const total = purchased + freeQty;
  return {
    purchased, free: freeQty,
    purchasedPct: total > 0 ? purchased / total * 100 : null,
    freePct: total > 0 ? freeQty / total * 100 : null,
  };
}

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

export function HoldingsTable({ rows, events, waxUsd, cur, realisable, onPick }: {
  rows: HoldingRow[]; events: FolioEvent[]; waxUsd: number; cur: Currency; realisable?: Map<string, Realisable>; onPick: (r: HoldingRow) => void;
}) {
  const usd = cur === 'USD';
  const acquisitions = useMemo(() => new Map(rows.filter((r) => r.position).map((r) => [
    r.key, acquisitionBreakdown(r.key, events, r.position?.freeQty ?? 0),
  ])), [rows, events]);
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/50 bg-card/60">
      <table aria-label="Holdings" className="w-full min-w-[1080px] table-fixed text-xs xl:text-sm [&_th]:px-2 [&_td]:px-2 [&_td]:py-2 [&_td]:break-words [&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-6 [&_td:last-child]:pr-6">
        <colgroup>
          <col className="w-[19%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead className="text-xs uppercase text-muted-foreground whitespace-normal">
          <tr className="border-b border-border/50">
            <th className="px-3 py-2 text-left">Token</th>
            <th className="px-3 py-2 text-right">Balance</th>
            <th className="px-3 py-2 text-right">Avg cost</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right" title="Amount × current price">Paper value</th>
            <th className="px-3 py-2 text-right" title="What selling the whole balance on Alcor would return right now">Realisable</th>
            <th className="px-3 py-2 text-right">Unrealised P/L</th>
            <th className="px-3 py-2 text-right">Realised P/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rz = realisable?.get(r.key);
            const rzWax = r.key === 'eosio.token:WAX' ? r.balance : rz?.wax ?? null;
            const unreal = usd ? r.unrealizedUsd : r.unrealizedWax;
            const unrealPct = usd ? r.unrealizedPctUsd : r.unrealizedPct;
            const realized = usd ? r.realizedUsd : r.realizedWax;
            const avg = usd ? r.avgCostUsd : r.avgCostWax;
            const usdMissing = usd && r.complete && !r.usdComplete;
            const receipts = acquisitions.get(r.key);
            return (
            <tr key={r.key} className="cursor-pointer border-b border-border/30 hover:bg-cheese/5" onClick={() => onPick(r)}>
              <td className="whitespace-normal">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                  <TokenLogo contract={r.contract} symbol={r.symbol} size="sm" />
                    <span className="font-semibold">{r.symbol}</span>
                    <span className="text-[11px] text-muted-foreground">{r.contract}</span>
                  </div>
                    <div className="flex flex-wrap gap-1 empty:hidden">
                  {!r.complete ? (
                    <span className="rounded border border-destructive/40 px-1 text-[10px] text-destructive" title={r.pooledUnknown ? "Some pool positions couldn't be read, so profit/loss is hidden for this token." : "Your saved history doesn't add up to your live balance (wallet plus pools), so profit/loss is hidden for this token."}>
                      history incomplete
                    </span>
                  ) : usdMissing ? (
                    <span className="rounded border border-cheese/40 px-1 text-[10px] text-cheese" title="Some of this token's trades happened on days with no recorded WAX/USD rate.">
                      no USD rate
                    </span>
                  ) : r.position?.unpricedBuys ? (
                    <span className="rounded border border-cheese/40 px-1 text-[10px] text-cheese" title="Some of this token was acquired without a known WAX value.">
                      partly unpriced
                    </span>
                  ) : null}
                    </div>
                    {receipts ? (
                      <div className="text-[11px] leading-4 text-muted-foreground" title="All-time recorded receipts, not the source of your current balance. Based on available history; average cost is unchanged.">
                        <div>Bought (all-time): <span className="text-foreground">{fmt(receipts.purchased, r.precision)}</span>{receipts.purchasedPct == null ? '' : ` · ${fmt(receipts.purchasedPct, 1)}%`}</div>
                        <div>Gifted / Reward: <span className="text-foreground">{fmt(receipts.free, r.precision)}</span>{receipts.freePct == null ? '' : ` · ${fmt(receipts.freePct, 1)}%`}</div>
                      </div>
                    ) : null}
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <div>{fmt(r.balance, r.precision)}</div>
                {r.pooledBalance > 0 ? (
                  <div className="text-xs text-muted-foreground" title={r.pooledParts.map((x) => `${fmt(x.qty, r.precision)} in ${x.venue} ${x.pair}`).join('\n')}>
                    {fmt(r.pooledBalance, r.precision)} in pools
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right">{avg == null ? '—' : usd ? `$${fmt(avg, 6)}` : fmt(avg, 6)}</td>
              <td className="px-3 py-2 text-right">{r.priceWax == null ? '—' : usd ? (waxUsd ? `$${fmt(r.priceWax * waxUsd, 6)}` : '—') : fmt(r.priceWax, 6)}</td>
              <td className="px-3 py-2 text-right">
                <div>{usd ? money(r.valueUsd, cur) : waxFmt(r.valueWax)}</div>
                {!usd ? <div className="text-xs text-muted-foreground">{usdFmt(r.valueWax, waxUsd)}</div> : null}
              </td>
              <td className="px-3 py-2 text-right">
                {rzWax == null ? (
                  <span className="text-muted-foreground">{realisable || r.key === 'eosio.token:WAX' ? '—' : '…'}</span>
                ) : (
                  <>
                    <div>{usd ? money(waxUsd ? rzWax * waxUsd : null, cur) : waxFmt(rzWax)}</div>
                    {rz?.gapPct != null ? <div className={`text-xs ${rz.gapPct < -0.05 ? 'text-destructive' : 'text-muted-foreground'}`}>{signed(rz.gapPct)}% vs paper</div> : null}
                  </>
                )}
              </td>
              <td className={`px-3 py-2 text-right ${plClass(unreal)}`}>
                {unreal == null ? '—' : signedMoney(unreal, cur)}
                {unrealPct != null ? <div className="text-xs">{signed(unrealPct)}%</div> : null}
              </td>
              <td className={`px-3 py-2 text-right ${plClass(realized || null)}`}>{realized ? signedMoney(realized, cur) : '—'}</td>
            </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No tokens with a balance.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const PAGE = 100;

export function ActivityList({
  events, value, realized, filter, cur = 'WAX',
}: { events: FolioEvent[]; value: Map<string, number>; realized: Map<string, number>; filter?: string; cur?: Currency }) {
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
                  <td className="px-3 py-2 text-right whitespace-nowrap">{value.has(e.id) ? money(value.get(e.id), cur) : '—'}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${plClass(r)}`}>{r == null ? '—' : signedMoney(r, cur)}</td>
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

export function PlChart({ data, title, cur = 'WAX' }: { data: { date: string; value: number }[]; title: string; cur?: Currency }) {
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
              formatter={(v: number) => [money(v, cur), title]}
            />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill={`url(#folio-${title})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TokenDialog({
  row, events, value, realized, waxUsd, cur, realisable, onClose,
}: {
  row: HoldingRow | null; events: FolioEvent[]; value: Map<string, number>; realized: Map<string, number>; waxUsd: number;
  cur: Currency; realisable?: Realisable | null; onClose: () => void;
}) {
  const p = row?.position;
  const acquisitions = useMemo(() => row && p ? acquisitionBreakdown(row.key, events, p.freeQty) : null, [row, p, events]);
  const usd = cur === 'USD';
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TokenLogo contract={row.contract} symbol={row.symbol} size="md" />
                {row.symbol} <span className="text-sm font-normal text-muted-foreground">{row.contract}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <SummaryBox label="Balance" value={fmt(row.balance, row.precision)} sub={usd ? money(row.valueUsd, cur) : usdFmt(row.valueWax, waxUsd)} />
              <SummaryBox label="Avg cost" value={usd ? (row.avgCostUsd == null ? '—' : `$${fmt(row.avgCostUsd, 6)}`) : row.avgCostWax == null ? '—' : `${fmt(row.avgCostWax, 6)} WAX`} />
              <SummaryBox
                label="Realisable now"
                value={realisable?.wax == null ? '—' : usd ? money(waxUsd ? realisable.wax * waxUsd : null, cur) : waxFmt(realisable.wax)}
                sub={realisable?.gapPct != null ? `${signed(realisable.gapPct)}% vs paper value` : undefined}
              />
              <SummaryBox label="Unrealised" value={(usd ? row.unrealizedUsd : row.unrealizedWax) == null ? '—' : signedMoney((usd ? row.unrealizedUsd : row.unrealizedWax)!, cur)} tone={usd ? row.unrealizedUsd : row.unrealizedWax} />
              <SummaryBox label="Realised" value={signedMoney(usd ? row.realizedUsd : row.realizedWax, cur)} tone={usd ? row.realizedUsd : row.realizedWax} />
            </div>
            {p && acquisitions ? (
              <section aria-label="Acquisition breakdown" className="border-y border-border/50 py-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <h3 className="text-sm font-semibold">Acquisition breakdown</h3>
                  <span className="text-xs text-muted-foreground">All-time recorded receipts · not current balance</span>
                </div>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Purchased</dt>
                    <dd className="font-medium break-words">{fmt(acquisitions.purchased, p.precision)} {row.symbol}
                      <span className="ml-2 text-xs text-muted-foreground">{acquisitions.purchasedPct == null ? '—' : `${fmt(acquisitions.purchasedPct, 1)}%`}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Gifted / Reward</dt>
                    <dd className="font-medium break-words">{fmt(acquisitions.free, p.precision)} {row.symbol}
                      <span className="ml-2 text-xs text-muted-foreground">{acquisitions.freePct == null ? '—' : `${fmt(acquisitions.freePct, 1)}%`}</span>
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">Free receipts include transfers, airdrops, rewards and pool gains; their recorded cost is zero.{!row.complete ? ' Based on available history only.' : ''}</p>
              </section>
            ) : null}
            {p ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-3">
                <div>Sold: <span className="text-foreground">{fmt(p.soldQty, p.precision)}</span></div>
                <div>On order: <span className="text-foreground">{fmt(p.onOrderQty, p.precision)}</span></div>
                <div>In liquidity (at cost): <span className="text-foreground">{fmt(p.inLiquidityQty, p.precision)}</span></div>
                <div>History total: <span className="text-foreground">{fmt(p.qty, p.precision)}</span></div>
              </div>
            ) : null}
            {row.pooledBalance > 0 ? (
              <div className="rounded-md border border-border/50 p-3 text-sm space-y-1">
                <div className="text-muted-foreground">
                  Wallet <span className="text-foreground">{fmt(row.walletBalance, row.precision)}</span> · In pools <span className="text-foreground">{fmt(row.pooledBalance, row.precision)}</span>
                </div>
                {row.pooledParts.map((x) => (
                  <div key={`${x.venue}:${x.pair}`} className="flex justify-between gap-4">
                    <span>{x.venue === 'alcor' ? 'Alcor' : x.venue === 'taco' ? 'Taco' : 'Defibox'} · {x.pair}</span>
                    <span>{fmt(x.qty, row.precision)} {row.symbol}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {!row.complete ? (
              <p className="text-sm text-destructive">
                {row.pooledUnknown
                  ? "Some of your pool positions couldn't be read right now, so profit/loss for this token is hidden. "
                  : row.pooledBalance > 0 && !(row.position && row.position.inLiquidityQty > 0)
                    ? "This token is in a pool, but your saved history has no deposit of it, so its cost is unknown and profit/loss is hidden. "
                    : 'Your saved history adds up to a different balance than your wallet shows, so profit/loss for this token is hidden. '}
                This usually means some history wasn't available — try "Rescan from scratch".
              </p>
            ) : null}
            <ActivityList events={events} value={value} realized={realized} filter={row.key} cur={cur} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
