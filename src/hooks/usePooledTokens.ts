import { useQuery } from '@tanstack/react-query';
import { fetchPooledTokens, type ShareBalance } from '@/lib/folio/pooled';

/** Live amounts the account holds in Alcor, Taco and Defibox pools. */
export function usePooledTokens(account: string | null, shares: ShareBalance[], sharesReady: boolean) {
  const sig = shares.map((s) => `${s.contract}:${s.symbol}:${s.balance}`).sort().join('|');
  return useQuery({
    queryKey: ['folio-pooled', account, sig],
    queryFn: () => fetchPooledTokens(account!, shares),
    enabled: !!account && sharesReady,
    staleTime: 60_000,
    retry: 1,
  });
}
