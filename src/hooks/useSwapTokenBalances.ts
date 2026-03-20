import { useQuery } from "@tanstack/react-query";
import type { SwapToken } from "@/lib/swapApi";
import type { TokenWithBalance } from "@/hooks/useAllTokenBalances";

/**
 * Reads all swap-relevant token balances from the shared `all-token-balances` cache.
 * No additional API calls — reactive subscription to the shared query.
 */
export function useSwapTokenBalances(
  accountName: string | null,
  tokens: SwapToken[],
  enabled: boolean = true
) {
  const { data: balances } = useQuery<{ tokens: TokenWithBalance[] }, Error, Map<string, string>>({
    queryKey: ["all-token-balances", accountName],
    enabled: false, // Don't trigger a fetch — just subscribe to existing cache
    select: (data) => {
      const map = new Map<string, string>();
      if (!data?.tokens) return map;
      for (const tb of data.tokens) {
        if (tb.balance > 0) {
          map.set(`${tb.symbol}_${tb.contract}`, String(tb.balance));
        }
      }
      return map;
    },
  });

  return balances ?? new Map<string, string>();
}
