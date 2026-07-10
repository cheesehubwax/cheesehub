import { useQuery, skipToken } from "@tanstack/react-query";
import type { TokenWithBalance } from "@/hooks/useAllTokenBalances";
import { fetchSingleTokenBalance } from "@/lib/waxRpcFallback";

/**
 * Reads a single token balance from the shared `all-token-balances` cache.
 * Falls back to a direct RPC call if the shared cache has no data yet.
 */
export function useSwapTokenBalance(
  accountName: string | null,
  contract?: string,
  ticker?: string
) {
  // Try reading from the shared cache first (reactive via select)
  const { data: cachedBalance } = useQuery<{ tokens: TokenWithBalance[] }, Error, string | null>({
    queryKey: ["all-token-balances", accountName],
    queryFn: skipToken, // Never fetches — only subscribes to the shared cache
    select: (data) => {
      if (!contract || !ticker || !data?.tokens) return null;
      const match = data.tokens.find(
        (t) => t.contract === contract && t.symbol === ticker
      );
      return match && match.balance > 0 ? String(match.balance) : null;
    },
  });

  // Fallback: if shared cache has nothing, do a single RPC call
  const { data: rpcBalance } = useQuery({
    queryKey: ["swap-token-balance-fallback", accountName, contract, ticker],
    queryFn: async () => {
      const amount = await fetchSingleTokenBalance(accountName!, contract!, ticker!);
      return amount > 0 ? String(amount) : null;
    },
    enabled: !!accountName && !!contract && !!ticker && cachedBalance === undefined,
    staleTime: 30_000,
    gcTime: 120_000,
  });

  return cachedBalance ?? rpcBalance ?? null;
}
