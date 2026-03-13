import { useQuery } from '@tanstack/react-query';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=wax&vs_currencies=usd';

async function fetchWaxPrice(): Promise<number> {
  const response = await fetch(COINGECKO_API);
  if (!response.ok) throw new Error('Failed to fetch WAX price');
  const data = await response.json();
  return data?.wax?.usd || 0;
}

export function useWaxPrice() {
  return useQuery<number>({
    queryKey: ['wax-price'],
    queryFn: fetchWaxPrice,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
    initialData: 0,
  });
}
