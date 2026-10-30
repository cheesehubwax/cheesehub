// Holdings as sortable table or mobile cards.
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { TokenLogo } from '@/components/TokenLogo';
import type { FolioEvent } from '@/lib/folio/types';
import type { HoldingRow } from '@/lib/folio/holdings';
import type { Realisable } from '@/hooks/useRealisableValues';
import { useIsMobile } from '@/hooks/use-mobile';
import type { DisplayCode } from '@/lib/folio/fxCore';
import { fiatFmt, fmt, waxFmt, usdFmt, money, signedMoney, plClass, signed, type Currency } from '@/components/folio/format';
import { acquisitionBreakdown, holdingCost } from '@/lib/folio/acquisitions';
import { GiftListDialog } from '@/components/folio/GiftListDialog';

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
