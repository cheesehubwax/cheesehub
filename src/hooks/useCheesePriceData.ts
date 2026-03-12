import { useQuery } from '@tanstack/react-query';

interface AlcorTokenResponse {
  id: string;
  contract: string;
  symbol: string;
  system_price: number;
  usd_price: number;
}

export interface CheesePriceData {
  waxPrice: number;
  usdPrice: number;
}

async function fetchCheesePriceData(): Promise<CheesePriceData> {
  const response = await fetch('https://wax.alcor.exchange/api/v2/tokens/cheese-cheeseburger');

  if (!response.ok) {
    throw new Error('Failed to fetch CHEESE price data');
  }

  const data: AlcorTokenResponse = await response.json();

  return {
    waxPrice: data.system_price,
    usdPrice: data.usd_price,
  };
}

export function useCheesePriceData() {
  return useQuery<CheesePriceData>({
    queryKey: ['cheese-price'],
    queryFn: fetchCheesePriceData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
  });
}
