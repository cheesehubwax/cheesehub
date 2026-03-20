import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { fetchAllTokenBalances, fetchAllTokenBalancesViaRpc, HyperionToken } from '@/lib/waxRpcFallback';

export interface TokenWithBalance extends TokenConfig {
  balance: number;
  isLpToken: boolean;
}

// Create a lookup map for our known tokens
const TOKEN_REGISTRY_MAP = new Map<string, TokenConfig>();
WAX_TOKENS.forEach(token => {
  TOKEN_REGISTRY_MAP.set(`${token.contract}:${token.symbol}`, token);
});

// LP token contracts
const LP_TOKEN_CONTRACTS = ['lptoken.box', 'swap.taco'];

function isLpToken(contract: string): boolean {
  return LP_TOKEN_CONTRACTS.includes(contract);
}

async function fetchBalancesForAccount(accountName: string): Promise<{ tokens: TokenWithBalance[]; usedFallback: boolean }> {
  let results: TokenWithBalance[] = [];
  let usedFallback = false;

  try {
    const hyperionResult = await fetchAllTokenBalances(accountName);

    if (hyperionResult.isStale) {
      console.warn('[Balance] Hyperion is stale, falling back to RPC for real-time balances');
      usedFallback = true;

      const rpcBalances = await fetchAllTokenBalancesViaRpc(
        accountName,
        WAX_TOKENS.map(t => ({ contract: t.contract, symbol: t.symbol, precision: t.precision }))
      );

      for (const [key, data] of rpcBalances) {
        const [contract, symbol] = key.split(':');
        const knownToken = TOKEN_REGISTRY_MAP.get(key);
        results.push({
          symbol,
          contract,
          precision: knownToken?.precision || data.precision,
          displayName: knownToken?.displayName || symbol,
          balance: data.balance,
          isLpToken: isLpToken(contract),
        });
      }
    } else {
      results = hyperionResult.tokens.map((ht: HyperionToken) => {
        const key = `${ht.contract}:${ht.symbol}`;
        const knownToken = TOKEN_REGISTRY_MAP.get(key);
        if (knownToken) {
          return { ...knownToken, balance: ht.amount, isLpToken: isLpToken(ht.contract) };
        } else {
          return {
            symbol: ht.symbol,
            contract: ht.contract,
            precision: ht.precision || 8,
            displayName: ht.symbol,
            balance: ht.amount,
            isLpToken: isLpToken(ht.contract),
          };
        }
      });
      console.log('[Balance] Hyperion returned', results.length, 'tokens (fresh data)');
    }
  } catch (error) {
    console.warn('[Balance] Hyperion failed, using RPC fallback for all tokens:', error);
    usedFallback = true;

    try {
      const rpcBalances = await fetchAllTokenBalancesViaRpc(
        accountName,
        WAX_TOKENS.map(t => ({ contract: t.contract, symbol: t.symbol, precision: t.precision }))
      );

      for (const [key, data] of rpcBalances) {
        const [contract, symbol] = key.split(':');
        const knownToken = TOKEN_REGISTRY_MAP.get(key);
        results.push({
          symbol,
          contract,
          precision: knownToken?.precision || data.precision,
          displayName: knownToken?.displayName || symbol,
          balance: data.balance,
          isLpToken: isLpToken(contract),
        });
      }
      console.log('[Balance] RPC fallback returned', results.length, 'tokens with balance');
    } catch (rpcError) {
      console.error('[Balance] RPC fallback also failed:', rpcError);
    }
  }

  // Sort: alphabetically, with LP tokens at bottom
  const sorted = results
    .filter(t => t.balance > 0)
    .sort((a, b) => {
      if (a.isLpToken && !b.isLpToken) return 1;
      if (!a.isLpToken && b.isLpToken) return -1;
      return a.symbol.localeCompare(b.symbol);
    });

  console.log('[Balance]', usedFallback ? '(RPC fallback)' : '(Hyperion)', 'Found', sorted.length, 'tokens:',
    sorted.filter(t => !t.isLpToken).map(t => t.symbol).join(', '),
    '| LP:', sorted.filter(t => t.isLpToken).map(t => t.symbol).join(', ')
  );

  return { tokens: sorted, usedFallback };
}

export function useAllTokenBalances(accountName: string | null | undefined) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['all-token-balances', accountName],
    queryFn: () => fetchBalancesForAccount(accountName!),
    enabled: !!accountName,
    staleTime: 15_000,
    gcTime: 120_000,
  });

  const refetch = useCallback(() => {
    if (accountName) {
      queryClient.invalidateQueries({ queryKey: ['all-token-balances', accountName] });
    }
  }, [queryClient, accountName]);

  return {
    tokens: data?.tokens ?? [],
    isLoading,
    isUsingFallback: data?.usedFallback ?? false,
    refetch,
  };
}
