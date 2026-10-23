// CHEESEFolio presentation pieces.
import { useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TokenLogo } from '@/components/TokenLogo';
import type { FolioEvent, FolioEventType, TokenAmount } from '@/lib/folio/types';
import type { HoldingRow } from '@/lib/folio/holdings';
import type { Realisable } from '@/hooks/useRealisableValues';
import { useIsMobile } from '@/hooks/use-mobile';

import { CRYPTO_CURRENCIES, type DisplayCode } from '@/lib/folio/fxCore';

/** WAX, or the fiat/crypto currency the figures are shown in. */
export type Currency = 'WAX' | DisplayCode;

const fiatFormatters = new Map<string, Intl.NumberFormat>();
/** Fiat amount; `small` keeps up to 6 decimals for sub-unit prices. */
export function fiatFmt(v: number, code: DisplayCode, small = false): string {
  const crypto = CRYPTO_CURRENCIES.find((c) => c.code === code);
  if (crypto) {
    // Intl has no BTC/ETH currency; use the symbol with fixed decimals.
    return `${v < 0 ? '-' : ''}${crypto.symbol}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: crypto.decimals, maximumFractionDigits: crypto.decimals })}`;
  }
  const digits = small && Math.abs(v) < 1 && v !== 0 ? 6 : undefined;
  const key = `${code}:${digits ?? ''}`;
  let f = fiatFormatters.get(key);
  if (!f) {
    const base = new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    const def = base.resolvedOptions().maximumFractionDigits ?? 2;
    f = new Intl.NumberFormat(undefined, {
      style: 'currency', currency: code, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits ? 0 : def, maximumFractionDigits: digits ?? def,
    });
    fiatFormatters.set(key, f);
  }
  return f.format(v);
}

export const fmt = (v: number, max = 4) =>
  v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? Math.max(max, 6) : max });

export const waxFmt = (v: number | null | undefined) => (v == null ? '—' : `${fmt(v, 2)} WAX`);
/** A WAX amount converted at `rate` (fiat per WAX) into `code`. */
export const usdFmt = (wax: number | null | undefined, rate: number, code: DisplayCode = 'USD') =>
  wax == null || !rate ? '' : fiatFmt(wax * rate, code);

/** An amount already in `cur`. */
export const money = (v: number | null | undefined, cur: Currency) =>
  v == null ? '—' : cur !== 'WAX' ? fiatFmt(v, cur) : `${fmt(v, 2)} WAX`;
const signedMoney = (v: number, cur: Currency) => `${v >= 0 ? '+' : ''}${money(v, cur)}`;

const plClass = (v: number | null | undefined) => (v == null ? 'text-muted-foreground' : v >= 0 ? 'text-positive' : 'text-destructive');
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
  // Rewards are what reward.alcor sent; every other free receipt is gifted.
  const reward = events.reduce((sum, e) => e.type === 'reward' && e.counterparty === 'reward.alcor'
    ? sum + e.in.reduce((n, a) => n + (a.key === key ? a.amount : 0), 0)
    : sum, 0);
  const gifted = Math.max(0, freeQty - reward);
  const total = purchased + freeQty;
  return {
    purchased, reward, gifted,
    purchasedPct: total > 0 ? purchased / total * 100 : null,
    rewardPct: total > 0 ? reward / total * 100 : null,
    giftedPct: total > 0 ? gifted / total * 100 : null,
  };
}

/** Direct free receipts for one token, newest first: transfers in, excluding reward.alcor rewards (their own column). */
export function giftReceipts(key: string, events: FolioEvent[]) {
  return events
    .filter((e) => (e.type === 'received' || e.type === 'reward') && e.counterparty !== 'reward.alcor')
    .map((e) => ({ e, amount: e.in.reduce((s, a) => s + (a.key === key ? a.amount : 0), 0) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.e.ts - a.e.ts);
}

export function GiftListDialog({ row, events, onClose }: { row: HoldingRow | null; events: FolioEvent[]; onClose: () => void }) {
  const gifts = useMemo(() => (row ? giftReceipts(row.key, events) : []), [row, events]);
  const total = row?.position ? acquisitionBreakdown(row.key, events, row.position.freeQty).gifted : 0;
  const shown = gifts.reduce((s, g) => s + g.amount, 0);
  const other = Math.max(0, total - shown);
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TokenLogo contract={row.contract} symbol={row.symbol} size="md" />
                Gifted {row.symbol} <span className="text-sm font-normal text-muted-foreground">{fmt(total, row.precision)} total</span>
              </DialogTitle>
            </DialogHeader>
            <div className="w-full overflow-x-auto rounded-lg border border-border/50 bg-card/60">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-2 text-left">Date (UTC)</th>
                    <th className="px-3 py-2 text-left">From</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Memo</th>
                    <th className="px-3 py-2 text-right">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {gifts.map(({ e, amount }) => (
                    <tr key={e.id} className="border-b border-border/30 align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(e.ts).toISOString().slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-3 py-2 break-all">{e.counterparty ?? '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(amount, row.precision)} {row.symbol}</td>
                      <td className="px-3 py-2 break-words text-muted-foreground">{e.memo || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <a className="text-cheese hover:underline" href={`https://waxblock.io/transaction/${e.trx}`} target="_blank" rel="noopener noreferrer">
                          {e.trx.slice(0, 8)}
                        </a>
                      </td>
                    </tr>
                  ))}
                  {gifts.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No direct gift transfers recorded.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              All-time recorded receipts, not the source of your current balance.{!row.complete ? ' Based on available history only.' : ''}
              {other > 0 ? ` A further ${fmt(other, row.precision)} ${row.symbol} came from pool fee gains and order returns — see Activity.` : ''}
            </p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Remaining cost of visible live holdings; never replay or reprice the ledger. */
/** Per-asset Total Cost: what was paid for the tokens still held; closed rows show nothing. */
export function holdingCost(row: HoldingRow, usd: boolean): number | null {
  if (row.closed || row.balance <= 0) return null;
  return usd ? row.costUsd : row.costWax;
}

export function totalHoldingCost(rows: HoldingRow[]) {
  let wax = 0, usd = 0, knownWax = 0, knownUsd = 0, missingWax = false, missingUsd = false;
  for (const row of rows) {
    if (row.closed || row.balance <= 0) continue;
    const costWax = holdingCost(row, false);
    const costUsd = holdingCost(row, true);
    if (costWax == null) missingWax = true;
    else { wax += costWax; knownWax++; }
    if (costUsd == null) missingUsd = true;
    else { usd += costUsd; knownUsd++; }
  }
  return {
    wax: missingWax && !knownWax ? null : wax,
    usd: missingUsd && !knownUsd ? null : usd,
    partialWax: missingWax,
    partialUsd: missingUsd,
  };
}

export function SummaryBox({ label, value, sub, tone, subTone }: { label: string; value: string; sub?: string; tone?: number | null; subTone?: number | null }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-cheese/20 bg-cheese/5 px-4 py-3 text-center">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold break-words ${tone === undefined ? 'text-foreground' : plClass(tone)}`}>{value}</div>
      {sub ? <div className={`text-xs ${subTone == null ? 'text-muted-foreground' : plClass(subTone)}`}>{sub}</div> : null}
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

type SortCol = 'token' | 'balance' | 'avg' | 'price' | 'cost' | 'paper' | 'realisable' | 'unrealised' | 'realised';

/** Mobile card/table switch; desktop always uses the table. */
function ViewToggle({ view, setView }: { view: 'cards' | 'table'; setView: (v: 'cards' | 'table') => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Layout">
      <Button size="sm" variant={view === 'cards' ? 'default' : 'outline'} className="h-9 text-xs" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>▦ Cards</Button>
      <Button size="sm" variant={view === 'table' ? 'default' : 'outline'} className="h-9 text-xs" aria-pressed={view === 'table'} onClick={() => setView('table')}>☰ Table</Button>
    </div>
  );
}

export function HoldingsTable({ rows, events, waxUsd, cur, fiat = 'USD', realisable, onPick, portfolioAction }: {
  rows: HoldingRow[]; events: FolioEvent[]; waxUsd: number; cur: Currency; fiat?: DisplayCode; realisable?: Map<string, Realisable>; onPick: (r: HoldingRow) => void;
  portfolioAction?: (row: HoldingRow) => ReactNode;
}) {
  const usd = cur !== 'WAX';
  const fiatCode: DisplayCode = cur === 'WAX' ? fiat : cur;
  const acquisitions = useMemo(() => new Map(rows.filter((r) => r.position).map((r) => [
    r.key, acquisitionBreakdown(r.key, events, r.position?.freeQty ?? 0),
  ])), [rows, events]);
  const [giftsFor, setGiftsFor] = useState<HoldingRow | null>(null);
  const [sort, setSort] = useState<{ col: SortCol; dir: 1 | -1 }>({ col: 'paper', dir: -1 });
  const isMobile = useIsMobile();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const sorted = useMemo(() => {
    const val = (r: HoldingRow): number | string | null => {
      switch (sort.col) {
        case 'token': return r.symbol.toLowerCase();
        case 'balance': return r.balance;
        case 'avg': return usd ? r.avgCostUsd : r.avgCostWax;
        case 'price': return r.priceWax;
        case 'cost': return usd ? r.costUsd : r.costWax;
        case 'paper': return r.valueWax;
        case 'realisable': return r.key === 'eosio.token:WAX' ? r.balance : realisable?.get(r.key)?.wax ?? null;
        case 'unrealised': return usd ? r.unrealizedUsd : r.unrealizedWax;
        case 'realised': return (usd ? r.realizedUsd : r.realizedWax) || null;
      }
    };
    return rows.map((r) => ({ r, v: val(r) })).sort((a, b) => {
      if (a.v == null || b.v == null) return a.v == null ? (b.v == null ? 0 : 1) : -1; // blanks last
      const c = typeof a.v === 'string' ? a.v.localeCompare(b.v as string) : a.v - (b.v as number);
      return c * sort.dir;
    }).map((x) => x.r);
  }, [rows, sort, usd, realisable]);
  const head = (col: SortCol, label: string, left = false, title?: string) => (
    <th className={`px-3 py-2 ${left ? 'text-left' : 'text-right'}`} title={title} aria-sort={sort.col === col ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 uppercase hover:text-foreground ${sort.col === col ? 'text-foreground' : ''}`}
        onClick={() => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: col === 'token' ? 1 : -1 }))}
      >
        {label}<span className="text-[10px]">{sort.col === col ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
  if (isMobile && view === 'cards') {
    return (
      <div className="w-full space-y-2">
        <ViewToggle view={view} setView={setView} />
        {sorted.map((r) => {
          const rz = realisable?.get(r.key);
          const rzWax = r.key === 'eosio.token:WAX' ? r.balance : rz?.wax ?? null;
          const unreal = usd ? r.unrealizedUsd : r.unrealizedWax;
          const unrealPct = usd ? r.unrealizedPctUsd : r.unrealizedPct;
          const realized = usd ? r.realizedUsd : r.realizedWax;
          const avg = usd ? r.avgCostUsd : r.avgCostWax;
          const cost = holdingCost(r, usd);
          const usdMissing = usd && r.complete && !r.usdComplete;
          return (
            <div key={r.key} role="button" tabIndex={0} className="cursor-pointer rounded-lg border border-border/50 bg-card/60 p-3 space-y-2" onClick={() => onPick(r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPick(r); }}>
              <div className="flex items-center gap-2">
                <TokenLogo contract={r.contract} symbol={r.symbol} size="sm" />
                <span className="font-semibold">{r.symbol}</span>
                <span className="min-w-0 break-all text-xs text-muted-foreground">{r.contract}</span>
                {portfolioAction ? <span className="ml-auto" onClick={(e) => e.stopPropagation()}>{portfolioAction(r)}</span> : null}
              </div>
              <div className="flex flex-wrap gap-1 empty:hidden">
                {r.closed ? (
                  <span className="rounded border border-border px-1 text-[10px] text-muted-foreground">closed</span>
                ) : !r.complete ? (
                  <span className="rounded border border-destructive/40 px-1 text-[10px] text-destructive" title={r.pooledUnknown ? "Some pool positions couldn't be read, so profit/loss is hidden for this token." : "Your saved history doesn't add up to your live balance (wallet plus pools), so profit/loss is hidden for this token."}>history incomplete</span>
                ) : usdMissing ? (
                  <span className="rounded border border-cheese/40 px-1 text-[10px] text-cheese" title={`Some of this token's trades happened on days with no recorded WAX/${fiatCode} rate.`}>no {fiatCode} rate</span>
                ) : r.position?.unpricedBuys ? (
                  <span className="rounded border border-cheese/40 px-1 text-[10px] text-cheese" title="Some of this token was acquired without a known WAX value.">partly unpriced</span>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Balance</dt><dd className="text-right">{fmt(r.balance, r.precision)}{r.pooledBalance > 0 ? <span className="block text-xs text-muted-foreground">{fmt(r.pooledBalance, r.precision)} in pools</span> : null}</dd></div>
                <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Avg cost</dt><dd className="text-right">{avg == null ? '—' : usd ? fiatFmt(avg, fiatCode, true) : fmt(avg, 6)}</dd></div>
                <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Price</dt><dd className="text-right">{r.priceWax == null ? '—' : usd ? (waxUsd ? fiatFmt(r.priceWax * waxUsd, fiatCode, true) : '—') : fmt(r.priceWax, 6)}</dd></div>
                <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Total cost</dt><dd className="text-right">{cost == null ? '—' : usd ? fiatFmt(cost, fiatCode, true) : fmt(cost, 6)}</dd></div>
                <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Paper value</dt><dd className="text-right">{usd ? money(r.valueUsd, cur) : waxFmt(r.valueWax)}</dd></div>
                <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Realisable</dt><dd className="text-right">{r.closed ? '—' : rzWax == null ? '—' : usd ? money(waxUsd ? rzWax * waxUsd : null, cur) : waxFmt(rzWax)}</dd></div>
                <div className={`flex items-baseline justify-between gap-2 ${plClass(unreal)}`}><dt className="text-muted-foreground">Unrealised</dt><dd className="text-right">{unreal == null ? '—' : signedMoney(unreal, cur)}{unrealPct != null ? ` (${signed(unrealPct)}%)` : ''}</dd></div>
                <div className={`flex items-baseline justify-between gap-2 ${plClass(realized || null)}`}><dt className="text-muted-foreground">Realised</dt><dd className="text-right">{realized ? signedMoney(realized, cur) : '—'}</dd></div>
              </dl>
            </div>
          );
        })}
        {rows.length === 0 ? <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-6 text-center text-sm text-muted-foreground">No tokens with a balance.</div> : null}
        <GiftListDialog row={giftsFor} events={events} onClose={() => setGiftsFor(null)} />
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/50 bg-card/60">
      {isMobile ? <div className="border-b border-border/50 p-2"><ViewToggle view={view} setView={setView} /></div> : null}
      <table aria-label="Holdings" className="w-full min-w-[1140px] table-fixed text-xs xl:text-sm [&_th]:px-2 [&_td]:px-2 [&_td]:py-2 [&_td]:break-words [&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-6 [&_td:last-child]:pr-6">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="text-xs uppercase text-muted-foreground whitespace-normal">
          <tr className="border-b border-border/50">
            {head('token', 'Token', true)}
            {head('balance', 'Balance')}
            {head('avg', 'Avg cost')}
            {head('price', 'Price')}
            {head('cost', 'Total cost', false, "What you paid for the tokens you still hold, at each purchase day's rate")}
            {head('paper', 'Paper value', false, 'Amount × current price')}
            {head('realisable', 'Realisable', false, 'What selling the whole balance on Alcor would return right now')}
            {head('unrealised', 'Unrealised P/L')}
            {head('realised', 'Realised P/L')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const rz = realisable?.get(r.key);
            const rzWax = r.key === 'eosio.token:WAX' ? r.balance : rz?.wax ?? null;
            const unreal = usd ? r.unrealizedUsd : r.unrealizedWax;
            const unrealPct = usd ? r.unrealizedPctUsd : r.unrealizedPct;
            const realized = usd ? r.realizedUsd : r.realizedWax;
            const avg = usd ? r.avgCostUsd : r.avgCostWax;
            const cost = holdingCost(r, usd);
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
                    {portfolioAction ? <span className="ml-auto" onClick={(e) => e.stopPropagation()}>{portfolioAction(r)}</span> : null}
                  </div>
                    <div className="flex flex-wrap gap-1 empty:hidden">
                  {r.closed ? (
                    <span className="rounded border border-border px-1 text-[10px] text-muted-foreground" title="Nothing held now; only the profit/loss already locked in is shown.">
                      closed
                    </span>
                  ) : !r.complete ? (
                    <span className="rounded border border-destructive/40 px-1 text-[10px] text-destructive" title={r.pooledUnknown ? "Some pool positions couldn't be read, so profit/loss is hidden for this token." : "Your saved history doesn't add up to your live balance (wallet plus pools), so profit/loss is hidden for this token."}>
                      history incomplete
                    </span>
                  ) : usdMissing ? (
                    <span className="rounded border border-cheese/40 px-1 text-[10px] text-cheese" title={`Some of this token's trades happened on days with no recorded WAX/${fiatCode} rate.`}>
                      no {fiatCode} rate
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
                        <div>Reward: <span className="text-foreground">{fmt(receipts.reward, r.precision)}</span>{receipts.rewardPct == null ? '' : ` · ${fmt(receipts.rewardPct, 1)}%`}</div>
                        <div>Gifted: <button type="button" className="text-foreground underline decoration-dotted underline-offset-2 hover:text-cheese" title="Show every recorded gift" onClick={(e) => { e.stopPropagation(); setGiftsFor(r); }}>{fmt(receipts.gifted, r.precision)}</button>{receipts.giftedPct == null ? '' : ` · ${fmt(receipts.giftedPct, 1)}%`}</div>
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
              <td className="px-3 py-2 text-right">{avg == null ? '—' : usd ? fiatFmt(avg, fiatCode, true) : fmt(avg, 6)}</td>
              <td className="px-3 py-2 text-right">{r.priceWax == null ? '—' : usd ? (waxUsd ? fiatFmt(r.priceWax * waxUsd, fiatCode, true) : '—') : fmt(r.priceWax, 6)}</td>
              <td className="px-3 py-2 text-right">{cost == null ? '—' : usd ? fiatFmt(cost, fiatCode, true) : fmt(cost, 6)}</td>
              <td className="px-3 py-2 text-right">
                <div>{usd ? money(r.valueUsd, cur) : waxFmt(r.valueWax)}</div>
                {!usd ? <div className="text-xs text-muted-foreground">{usdFmt(r.valueWax, waxUsd, fiatCode)}</div> : null}
              </td>
              <td className="px-3 py-2 text-right">
                {r.closed ? <span className="text-muted-foreground">—</span> : rzWax == null ? (
                  <span className="text-muted-foreground">{realisable || r.key === 'eosio.token:WAX' ? '—' : '…'}</span>
                ) : (
                  <>
                    <div>{usd ? money(waxUsd ? rzWax * waxUsd : null, cur) : waxFmt(rzWax)}</div>
                    {rz?.gapPct != null ? <div className={`text-xs ${rz.gapPct >= 0 ? 'text-positive' : rz.gapPct < -0.05 ? 'text-destructive' : 'text-muted-foreground'}`}>{signed(rz.gapPct)}% vs paper</div> : null}
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
            <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No tokens with a balance.</td></tr>
          ) : null}
        </tbody>
      </table>
      <GiftListDialog row={giftsFor} events={events} onClose={() => setGiftsFor(null)} />
    </div>
  );
}

const PAGE = 100;

export function ActivityList({
  events, value, realized, filter, cur = 'WAX',
}: { events: FolioEvent[]; value: Map<string, number>; realized: Map<string, number>; filter?: string; cur?: Currency }) {
  const [type, setType] = useState<FolioEventType | 'all'>('all');
  const [shown, setShown] = useState(PAGE);
  const isMobile = useIsMobile();
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
          <Button key={t} size="sm" variant={type === t ? 'default' : 'outline'} className="h-9 md:h-7 text-xs" onClick={() => { setType(t); setShown(PAGE); }}>
            {t === 'all' ? 'All' : EVENT_LABELS[t]}
          </Button>
        ))}
      </div>
      {isMobile ? (
        <div className="space-y-2">
          {list.slice(0, shown).map((e) => {
            const r = realized.get(e.id);
            return (
              <div key={e.id} className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{EVENT_LABELS[e.type]}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{new Date(e.ts).toISOString().slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div className="text-xs text-muted-foreground">{e.venue ? VENUE_LABELS[e.venue] : e.counterparty}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div><div className="text-xs text-muted-foreground">Sent</div><AmountList items={e.out} /></div>
                  <div><div className="text-xs text-muted-foreground">Received</div><AmountList items={e.in} /></div>
                  <div><div className="text-xs text-muted-foreground">Value</div>{value.has(e.id) ? money(value.get(e.id), cur) : '—'}</div>
                  <div className={plClass(r)}><div className="text-xs text-muted-foreground">Realised P/L</div>{r == null ? '—' : signedMoney(r, cur)}</div>
                </div>
                <a className="text-xs text-cheese hover:underline" href={`https://waxblock.io/transaction/${e.trx}`} target="_blank" rel="noopener noreferrer">tx {e.trx.slice(0, 8)}</a>
              </div>
            );
          })}
          {list.length === 0 ? <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-6 text-center text-sm text-muted-foreground">Nothing here yet.</div> : null}
        </div>
      ) : (
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
      )}
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
      <div className="h-48 sm:h-72">
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
  row, events, value, realized, waxUsd, cur, fiat = 'USD', realisable, onClose,
}: {
  row: HoldingRow | null; events: FolioEvent[]; value: Map<string, number>; realized: Map<string, number>; waxUsd: number;
  cur: Currency; fiat?: DisplayCode; realisable?: Realisable | null; onClose: () => void;
}) {
  const p = row?.position;
  const acquisitions = useMemo(() => row && p ? acquisitionBreakdown(row.key, events, p.freeQty) : null, [row, p, events]);
  const [showGifts, setShowGifts] = useState(false);
  const usd = cur !== 'WAX';
  const cost = row ? holdingCost(row, usd) : null;
  const fiatCode: DisplayCode = cur === 'WAX' ? fiat : cur;
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
              <SummaryBox label="Balance" value={fmt(row.balance, row.precision)} sub={usd ? money(row.valueUsd, cur) : usdFmt(row.valueWax, waxUsd, fiatCode)} />
              <SummaryBox label="Avg cost" value={usd ? (row.avgCostUsd == null ? '—' : fiatFmt(row.avgCostUsd, fiatCode, true)) : row.avgCostWax == null ? '—' : `${fmt(row.avgCostWax, 6)} WAX`} />
              <SummaryBox label="Total cost" value={cost == null ? '—' : usd ? fiatFmt(cost, fiatCode, true) : `${fmt(cost, 6)} WAX`} />
              <SummaryBox
                label="Realisable now"
                value={realisable?.wax == null ? '—' : usd ? money(waxUsd ? realisable.wax * waxUsd : null, cur) : waxFmt(realisable.wax)}
                sub={realisable?.gapPct != null ? `${signed(realisable.gapPct)}% vs paper value` : undefined}
                subTone={realisable?.gapPct}
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
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Purchased</dt>
                    <dd className="font-medium break-words">{fmt(acquisitions.purchased, p.precision)} {row.symbol}
                      <span className="ml-2 text-xs text-muted-foreground">{acquisitions.purchasedPct == null ? '—' : `${fmt(acquisitions.purchasedPct, 1)}%`}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reward</dt>
                    <dd className="font-medium break-words">{fmt(acquisitions.reward, p.precision)} {row.symbol}
                      <span className="ml-2 text-xs text-muted-foreground">{acquisitions.rewardPct == null ? '—' : `${fmt(acquisitions.rewardPct, 1)}%`}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Gifted</dt>
                    <dd className="font-medium break-words"><button type="button" className="underline decoration-dotted underline-offset-2 hover:text-cheese" title="Show every recorded gift" onClick={() => setShowGifts(true)}>{fmt(acquisitions.gifted, p.precision)} {row.symbol}</button>
                      <span className="ml-2 text-xs text-muted-foreground">{acquisitions.giftedPct == null ? '—' : `${fmt(acquisitions.giftedPct, 1)}%`}</span>
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">Rewards are transfers from reward.alcor; gifted covers other free receipts such as transfers, airdrops and pool gains. Their recorded cost is zero.{!row.complete ? ' Based on available history only.' : ''}</p>
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
            {showGifts ? <GiftListDialog row={row} events={events} onClose={() => setShowGifts(false)} /> : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
