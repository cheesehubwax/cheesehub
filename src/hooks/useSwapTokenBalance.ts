import { useQuery } from "@tanstack/react-query";
import { fetchSingleTokenBalance } from "@/lib/waxRpcFallback";

export function useSwapTokenBalance(
  accountName: string | null,
  contract?: string,
  ticker?: string
) {
  const { data: balance } = useQuery({
    queryKey: ["swap-token-balance", accountName, contract, ticker],
    queryFn: async () => {
      const amount = await fetchSingleTokenBalance(accountName!, contract!, ticker!);
      return amount > 0 ? String(amount) : null;
    },
    enabled: !!accountName && !!contract && !!ticker,
    staleTime: 15_000,
    gcTime: 60_000,
  });

  return balance ?? null;
}
