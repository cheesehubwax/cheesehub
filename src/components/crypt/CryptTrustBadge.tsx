import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCryptTrust } from '@/hooks/useCryptTrust';
import { MARK_LABEL, scoreTrust, type TrustSignals } from '@/lib/cryptTrust';
import { CryptTrustBreakdown } from '@/components/crypt/CryptTrustBreakdown';
import { cn } from '@/lib/utils';

/** Messenger supplies local context (shared rooms, past chats); absent = not counted. */
export const CryptTrustContext = createContext<((account: string) => TrustSignals['local']) | null>(null);

const MARK_CLASS = {
  warning: 'border-destructive/50 text-destructive',
  low: 'border-cheese/40 text-cheese',
  moderate: 'border-border text-foreground',
  good: 'border-primary/50 text-primary',
  strong: 'border-primary text-primary',
} as const;

/** Compact strength badge; loads public signals only once it scrolls on screen. */
export function CryptTrustBadge({ account, className }: { account: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const signals = useCryptTrust(account, visible);
  const localFor = useContext(CryptTrustContext);
  const local = localFor?.(account);
  const score = useMemo(() => signals ? scoreTrust({ ...signals, local }) : null, [signals, local?.sharedRooms, local?.pastChat]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Popover>
    <PopoverTrigger asChild>
      <button ref={ref} type="button" aria-label={`Strength signals for ${account}`}
        className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-normal', score ? MARK_CLASS[score.mark] : 'border-border text-muted-foreground', className)}>
        {score ? <>{MARK_LABEL[score.mark]}{score.partial && '*'}</> : '… strength'}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80 p-3"><CryptTrustBreakdown account={account} score={score} /></PopoverContent>
  </Popover>;
}
