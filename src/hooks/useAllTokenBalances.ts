import { useState, useEffect, useCallback } from 'react';
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

export function useAllTokenBalances(accountName: string | null | undefined) {
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Hyperion-first fetch with full RPC fallback when Hyperion fails
  const fetchBalances = useCallback(async () => {
    if (!accountName) {
      setTokens([]);
      return;
    }

    console.log('[Balance] Fetching balances for:', accountName);
    setIsLoading(true);

    let results: TokenWithBalance[] = [];
    let usedFallback = false;

    try {
      // Try Hyperion first (fast, single API call, discovers unknown tokens)
      const hyperionResult = await fetchAllTokenBalances(accountName);

      // If Hyperion is stale, use RPC fallback instead
      if (hyperionResult.isStale) {
        console.warn('[Balance] Hyperion is stale, falling back to RPC for real-time balances');
        usedFallback = true;

        const rpcBalances = await fetchAllTokenBalancesViaRpc(
          accountName,
          WAX_TOKENS.map(t => ({ contract: t.contract, symbol: t.symbol, precision: t.precision }))
        );

        // Convert RPC results to TokenWithBalance format
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
        // Hyperion is fresh - use its data
        results = hyperionResult.tokens.map((ht: HyperionToken) => {
          const key = `${ht.contract}:${ht.symbol}`;
          const knownToken = TOKEN_REGISTRY_MAP.get(key);

          if (knownToken) {
            return {
              ...knownToken,
              balance: ht.amount,
              isLpToken: isLpToken(ht.contract),
            };
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
      // Hyperion completely failed - fall back to direct RPC for all registry tokens
      console.warn('[Balance] Hyperion failed, using RPC fallback for all tokens:', error);
      usedFallback = true;

      try {
        const rpcBalances = await fetchAllTokenBalancesViaRpc(
          accountName,
          WAX_TOKENS.map(t => ({ contract: t.contract, symbol: t.symbol, precision: t.precision }))
        );

        // Convert RPC results to TokenWithBalance format
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
    setIsUsingFallback(usedFallback);
    setTokens(sorted);
    setIsLoading(false);
  }, [accountName]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { tokens, isLoading, isUsingFallback, refetch: fetchBalances };
}
