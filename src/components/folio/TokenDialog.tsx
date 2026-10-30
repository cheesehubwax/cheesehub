// Per-token detail dialog.
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenLogo } from '@/components/TokenLogo';
import type { FolioEvent } from '@/lib/folio/types';
import type { HoldingRow } from '@/lib/folio/holdings';
import type { Realisable } from '@/hooks/useRealisableValues';
import type { DisplayCode } from '@/lib/folio/fxCore';
import { fiatFmt, fmt, waxFmt, usdFmt, money, signedMoney, signed, type Currency } from '@/components/folio/format';
import { acquisitionBreakdown, holdingCost } from '@/lib/folio/acquisitions';
import { SummaryBox } from '@/components/folio/SummaryBox';
import { GiftListDialog } from '@/components/folio/GiftListDialog';
import { ActivityList } from '@/components/folio/ActivityList';

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
