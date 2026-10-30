// Paged activity feed with per-event value and realised P/L.
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FolioEvent, FolioEventType } from '@/lib/folio/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { money, signedMoney, plClass, EVENT_LABELS, VENUE_LABELS, type Currency } from '@/components/folio/format';
import { AmountList } from '@/components/folio/SummaryBox';

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
