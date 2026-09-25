import { Info } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';
import { Button } from '@/components/ui/button';
import { getTokenLogoUrl } from '@/lib/tokenLogos';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const HOLE_FACTS = [
  ['Birthdate', '16 July 2026'],
  ['Total supply', '100,000.00000000 HOLE'],
  ['Token contract', 'hole.cheese'],
  ['Ticker', 'HOLE'],
  ['Precision', '8 decimals'],
] as const;

export function HoleInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-1 h-7 w-7 text-muted-foreground hover:text-cheese"
          title="About the HOLE token"
          aria-label="About the HOLE token"
        >
          <Info />
        </Button>
      </DialogTrigger>
      <DialogContent className="isolate w-[calc(100%-2rem)] max-w-md overflow-hidden [&>button]:z-10">
        <img
          src={getTokenLogoUrl('hole.cheese', 'HOLE')}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-40"
        />

        <DialogHeader className="relative pr-7">
          <DialogTitle className="flex items-center gap-3 text-left">
            <TokenLogo contract="hole.cheese" symbol="HOLE" size="lg" />
            HOLE Token
          </DialogTitle>
          <DialogDescription className="text-left">
            Token details on the WAX blockchain
          </DialogDescription>
        </DialogHeader>

        <dl className="relative divide-y divide-border rounded-lg border border-border bg-card/80 px-4 backdrop-blur-sm">
          {HOLE_FACTS.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all text-right font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="relative rounded-lg bg-background/75 p-3 text-sm leading-relaxed text-foreground backdrop-blur-sm">
          $HOLE is the 'Son Token' of $CHEESE. The first token contract born of the CHEESE account.
          100% of supply 100k was minted and immediately paired with 0 $CHEESE. $HOLE acts like a
          $CHEESE 'sink' or a hole hence its name.
        </p>
      </DialogContent>
    </Dialog>
  );
}