import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MAX_TOTAL_POINTS, RESPECT_LEVELS, TRUST_DISCLAIMER, type TrustMark } from '@/lib/cryptTrust';
import { CryptRespectMark } from './CryptRespectMark';

/** "Badge levels" link + small dialog listing every Respect level. Presentational only. */
export function CryptRespectLevels({ current }: { current?: TrustMark }) {
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="shrink-0 text-[11px] text-primary underline underline-offset-2 hover:opacity-80">Badge levels</button>
    </DialogTrigger>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Respect badge levels</DialogTitle>
        <DialogDescription>Scores run from 0 to {MAX_TOTAL_POINTS} points.</DialogDescription>
      </DialogHeader>
      <ul className="space-y-2 text-xs">
        {RESPECT_LEVELS.map(l => <li key={l.mark} className={`rounded-md border p-2 ${l.mark === current ? 'border-primary bg-primary/10' : 'border-border'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold"><CryptRespectMark mark={l.mark} /></span>
            <span className="text-right font-mono text-[11px] text-muted-foreground">{l.range}</span>
          </div>
          <p className="mt-1 text-muted-foreground">{l.description}{l.mark === current && <span className="font-semibold text-primary"> · You</span>}</p>
        </li>)}
      </ul>
      <p className="text-[10px] text-muted-foreground">{TRUST_DISCLAIMER}</p>
    </DialogContent>
  </Dialog>;
}
