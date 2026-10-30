// Summary box and token amount list used across CHEESEFolio.
import { TokenLogo } from '@/components/TokenLogo';
import type { TokenAmount } from '@/lib/folio/types';
import { fmt, plClass } from '@/components/folio/format';

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
