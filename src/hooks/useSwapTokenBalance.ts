import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TokenWithBalance } from "@/hooks/useAllTokenBalances";

/**
 * Reads a single token balance from the shared `all-token-balances` cache.
 * No additional API calls — just a cache lookup.
 */
export function useSwapTokenBalance(
  accountName: string | null,
  contract?: string,
  ticker?: string
) {
  const queryClient = useQueryClient();

  return useMemo(() => {
    if (!accountName || !contract || !ticker) return null;

    const cached = queryClient.getQueryData<{ tokens: TokenWithBalance[] }>([
      "all-token-balances",
      accountName,
    ]);

    if (!cached?.tokens) return null;

    const match = cached.tokens.find(
      (t) => t.contract === contract && t.symbol === ticker
    );

    return match && match.balance > 0 ? String(match.balance) : null;
  }, [queryClient, accountName, contract, ticker]);
}
