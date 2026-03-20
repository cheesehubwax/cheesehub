import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { SwapToken } from "@/lib/swapApi";
import type { TokenWithBalance } from "@/hooks/useAllTokenBalances";

/**
 * Reads all swap-relevant token balances from the shared `all-token-balances` cache.
 * No additional API calls — just a cache lookup mapped to swap token keys.
 */
export function useSwapTokenBalances(
  accountName: string | null,
  tokens: SwapToken[],
  enabled: boolean = true
) {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const map = new Map<string, string>();
    if (!accountName || !enabled) return map;

    const cached = queryClient.getQueryData<{ tokens: TokenWithBalance[] }>([
      "all-token-balances",
      accountName,
    ]);

    if (!cached?.tokens) return map;

    for (const tb of cached.tokens) {
      if (tb.balance > 0) {
        // Swap tokens use `ticker_contract` as key
        map.set(`${tb.symbol}_${tb.contract}`, String(tb.balance));
      }
    }

    return map;
  }, [queryClient, accountName, tokens, enabled]);
}
