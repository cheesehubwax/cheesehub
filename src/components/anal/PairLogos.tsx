// CHEESEAnal — CHEESE + paired token logos, overlapped the same way CheeseSwap's
// multi-route viewer shows a hop pair (second logo slightly behind the first).
import usdIcon from '@/assets/usd-icon.png';
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

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
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

/** Generic USD figures use the dollar-sign icon. */
export function UsdLogo({ size = 'sm', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <img
      src={usdIcon}
      alt="USD"
      className={cn(sizeClasses[size], 'rounded-full object-cover', className)}
      loading="lazy"
      decoding="async"
    />
  );
}

/** WAXUSDC token logo, for actual WAXUSDC token rows. */
export function WaxUsdcLogo({ size = 'sm', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return <TokenLogo contract="eth.token" symbol="WAXUSDC" size={size} className={className} />;
}
