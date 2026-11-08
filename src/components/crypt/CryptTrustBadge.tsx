import { CryptRespectArt } from './CryptRespectArt';
import { MARK_NAME } from '@/lib/cryptTrust';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCryptTrust } from '@/hooks/useCryptTrust';
import { scoreTrust } from '@/lib/cryptTrust';
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
  huge: 'border-2 border-cheese text-cheese',
} as const;

/** Compact Respect badge; loads public signals only once on screen. Others see only the mark and total. */
export function CryptTrustBadge({ account, className, variant = 'stacked' }: { account: string; className?: string; variant?: 'inline' | 'stacked' }) {
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
  const tone = score ? MARK_CLASS[score.mark] : 'border-border text-muted-foreground';
  const pts = score ? <span className="font-mono">{score.total}{score.partial && '*'}</span> : '…';
  const cls = variant === 'inline'
    ? cn('inline-flex shrink-0 items-center gap-0.5 align-middle text-[10px] font-semibold', tone.split(' ').filter(t => t.startsWith('text-')).join(' '), className)
    : cn('inline-flex w-[4.75rem] shrink-0 flex-col items-center gap-0.5 rounded-lg border bg-card/60 px-1 py-1 text-center leading-none font-normal', tone, className);
  const text = variant === 'inline'
    ? <>{score ? <CryptRespectArt mark={score.mark} size={20} /> : <span className="inline-block h-5 w-5 rounded-full border border-border" />}{pts}</>
    : <>{score ? <CryptRespectArt mark={score.mark} size={32} /> : <span className="inline-block h-8 w-8 rounded-full border border-border" />}
      <span className="text-[9px] font-semibold uppercase tracking-wide">{score ? MARK_NAME[score.mark] : 'Respect'}</span>
      <span className="text-[9px] text-muted-foreground">{pts} pts</span></>;
  if (!self) return <span ref={ref as React.RefObject<HTMLSpanElement>} className={cls} aria-label={`Respect for ${account}`}
    title={score?.partial ? 'Some public signals could not be read' : 'Respect: based on public blockchain data only'}>{text}</span>;
  return <Popover>
    <PopoverTrigger asChild>
      <button ref={ref as React.RefObject<HTMLButtonElement>} type="button" aria-label="Your Respect breakdown" className={cls}>{text}</button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80 p-3"><CryptTrustBreakdown account={account} score={score} /></PopoverContent>
  </Popover>;
}
