// CHEESEAnal — CHEESE + paired token logos, overlapped the same way CheeseSwap's
// multi-route viewer shows a hop pair (second logo slightly behind the first).
import { TokenLogo } from '@/components/TokenLogo';
import { cn } from '@/lib/utils';

export const CHEESE_CONTRACT = 'cheeseburger';

interface PairLogosProps {
  /** Paired token symbol, e.g. WAX. */
  symbol: string;
  /** Paired token contract, when known. */
  contract?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const overlap = {
  sm: '-ml-2',
  md: '-ml-3',
  lg: '-ml-4',
} as const;

export function PairLogos({ symbol, contract, size = 'sm', className }: PairLogosProps) {
  return (
    <span className={cn('inline-flex items-center align-middle', className)}>
      <TokenLogo contract={CHEESE_CONTRACT} symbol="CHEESE" size={size} />
      <span className={cn(overlap[size], 'ring-2 ring-background rounded-full inline-flex')}>
        <TokenLogo contract={contract ?? ''} symbol={symbol} size={size} />
      </span>
    </span>
  );
}

/** Overlapped logos plus the `CHEESE / SYMBOL` label. */
export function PairLabel({ symbol, contract, size = 'sm', className }: PairLogosProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <PairLogos symbol={symbol} contract={contract} size={size} />
      <span>
        <span className="text-cheese">CHEESE</span> / {symbol}
      </span>
    </span>
  );
}

/** Single CHEESE token logo, for CHEESE-only figures. */
export function CheeseLogo({ size = 'sm', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return <TokenLogo contract={CHEESE_CONTRACT} symbol="CHEESE" size={size} className={className} />;
}

/** USD figures are always represented by the WAXUSDC logo. */
export function UsdcLogo({ size = 'sm', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return <TokenLogo contract="alien.worlds" symbol="WAXUSDC" size={size} className={className} />;
}
