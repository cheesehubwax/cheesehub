// Lists every free receipt behind a token's gifted amount.
import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenLogo } from '@/components/TokenLogo';
import type { FolioEvent } from '@/lib/folio/types';
import type { HoldingRow } from '@/lib/folio/holdings';
import { fmt } from '@/components/folio/format';
import { acquisitionBreakdown, giftReceipts } from '@/lib/folio/acquisitions';

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
