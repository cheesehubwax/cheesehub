import { useQuery } from '@tanstack/react-query';

interface AlcorToken {
  id: string;
  contract: string;
  symbol: string;
  system_price: number; // Price in WAX
  usd_price: number;
}

// Map of contract:symbol -> price in WAX
export type TokenPriceMap = Map<string, number>;

async function fetchAlcorTokenPrices(): Promise<TokenPriceMap> {
  const response = await fetch('https://wax.alcor.exchange/api/v2/tokens');

  if (!response.ok) {
    throw new Error('Failed to fetch Alcor token prices');
  }

  const tokens: AlcorToken[] = await response.json();
  const priceMap = new Map<string, number>();

  tokens.forEach(token => {
    if (token.system_price > 0) {
      // Create key as contract:symbol
      const key = `${token.contract}:${token.symbol}`;
      priceMap.set(key, token.system_price);
    }
  });

  return priceMap;
}

export function useAlcorTokenPrices() {
  return useQuery<TokenPriceMap>({
    queryKey: ['alcor-token-prices'],
    queryFn: fetchAlcorTokenPrices,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // 1 minute
    retry: 2,
  });
}
