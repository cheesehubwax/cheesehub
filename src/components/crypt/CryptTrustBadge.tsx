import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCryptTrust } from '@/hooks/useCryptTrust';
import { MARK_LABEL, scoreTrust } from '@/lib/cryptTrust';
import { CryptTrustBreakdown } from '@/components/crypt/CryptTrustBreakdown';
import { cn } from '@/lib/utils';

/** Messenger supplies the signed-in account; only that account's badge opens a breakdown. */
export const CryptTrustContext = createContext<string | null>(null);

const MARK_CLASS = {
  warning: 'border-destructive/50 text-destructive',
  low: 'border-cheese/40 text-cheese',
  moderate: 'border-border text-foreground',
  good: 'border-primary/50 text-primary',
  strong: 'border-primary text-primary',
} as const;

/** Compact Respect badge; loads public signals only once on screen. Others see only the mark and total. */
export function CryptTrustBadge({ account, className }: { account: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const signals = useCryptTrust(account, visible);
  const self = useContext(CryptTrustContext) === account;
  const score = useMemo(() => signals ? scoreTrust(signals) : null, [signals]);
  const cls = cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-normal', score ? MARK_CLASS[score.mark] : 'border-border text-muted-foreground', className);
  const text = score ? <>{MARK_LABEL[score.mark]} {score.total}{score.partial && '*'} Respect</> : '… Respect';
  if (!self) return <span ref={ref as React.RefObject<HTMLSpanElement>} className={cls} aria-label={`Respect for ${account}`}
    title={score?.partial ? 'Some public signals could not be read' : 'Respect: based on public blockchain data only'}>{text}</span>;
  return <Popover>
    <PopoverTrigger asChild>
      <button ref={ref as React.RefObject<HTMLButtonElement>} type="button" aria-label="Your Respect breakdown" className={cls}>{text}</button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80 p-3"><CryptTrustBreakdown account={account} score={score} /></PopoverContent>
  </Popover>;
}
