// CHEESEAnal — base token + paired token logos, overlapped the same way
// CheeseSwap's multi-route viewer shows a hop pair (second logo slightly behind
// the first). The base token is CHEESE unless the HOLE tab is open.
import usdIcon from '@/assets/usd-icon.png';
import { TokenLogo } from '@/components/TokenLogo';
import { CHEESE_TOKEN, type LpToken } from '@/lib/lpPools';
import { cn } from '@/lib/utils';

export const CHEESE_CONTRACT = CHEESE_TOKEN.contract;

interface PairLogosProps {
  /** Paired token symbol, e.g. WAX. */
  symbol: string;
  /** Paired token contract, when known. */
  contract?: string;
  /** Base token of the open tab. */
  base?: LpToken;
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

export function PairLogos({ symbol, contract, base = CHEESE_TOKEN, size = 'sm', className }: PairLogosProps) {
  return (
    <span className={cn('inline-flex items-center align-middle', className)}>
      <TokenLogo contract={base.contract} symbol={base.symbol} size={size} />
      <span className={cn(overlap[size], 'ring-2 ring-background rounded-full inline-flex')}>
        <TokenLogo contract={contract ?? ''} symbol={symbol} size={size} />
      </span>
    </span>
  );
}

/** Overlapped logos plus the `BASE / SYMBOL` label. */
export function PairLabel({ symbol, contract, base = CHEESE_TOKEN, size = 'sm', className }: PairLogosProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <PairLogos symbol={symbol} contract={contract} base={base} size={size} />
      <span>
        <span className="text-cheese">{base.symbol}</span> / {symbol}
      </span>
    </span>
  );
}

/** Single base-token logo, for base-token-only figures. */
export function CheeseLogo({
  base = CHEESE_TOKEN,
  size = 'sm',
  className,
}: {
  base?: LpToken;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return <TokenLogo contract={base.contract} symbol={base.symbol} size={size} className={className} />;
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
