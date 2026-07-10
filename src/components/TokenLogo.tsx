import { useState } from 'react';
import { getTokenLogoUrl } from '@/lib/tokenLogos';
import { hasMissingLogo, markMissingLogo } from '@/lib/tokenLogoMisses';
import { cn } from '@/lib/utils';

interface TokenLogoProps {
  contract: string;
  symbol: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

const fontSizeClasses = {
  sm: 'text-[8px]',
  md: 'text-xs',
  lg: 'text-sm',
};

export function TokenLogo({ contract, symbol, className, size = 'md' }: TokenLogoProps) {
  const [hasError, setHasError] = useState(() => hasMissingLogo(contract, symbol));
  const logoUrl = getTokenLogoUrl(contract, symbol);

  if (hasError) {
    return (
      <div
        className={cn(
          sizeClasses[size],
          fontSizeClasses[size],
          'rounded-full bg-cheese/20 flex items-center justify-center text-cheese font-bold',
          className
        )}
      >
        {symbol.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={symbol}
      className={cn(sizeClasses[size], 'rounded-full object-cover', className)}
      loading="lazy"
      decoding="async"
      onError={() => {
        markMissingLogo(contract, symbol);
        setHasError(true);
      }}
    />
  );
}
