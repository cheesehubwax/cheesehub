import { useState } from 'react';
import { getTokenLogoUrl, TOKEN_LOGO_PLACEHOLDER } from '@/lib/tokenLogos';
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

export function TokenLogo({ contract, symbol, className, size = 'md' }: TokenLogoProps) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getTokenLogoUrl(contract, symbol);

  return (
    <img
      src={hasError ? TOKEN_LOGO_PLACEHOLDER : logoUrl}
      alt={symbol}
      className={cn(sizeClasses[size], 'rounded-full object-cover', className)}
      onError={() => setHasError(true)}
    />
  );
}
