import { useState, useEffect, useCallback } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { WAX_TOKENS } from '@/lib/tokenRegistry';

export interface TokenBalance {
  symbol: string;
  amount: number;
  formatted: string;
  contract: string;
  precision: number;
}

export function useAllTokenBalances(account: string | undefined) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllBalances = useCallback(async () => {
    if (!account) {
      setBalances([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results: TokenBalance[] = [];

      // Fetch balances from all known token contracts
      const uniqueContracts = [...new Set(WAX_TOKENS.map(t => t.contract))];

      await Promise.all(
        uniqueContracts.map(async (contract) => {
          try {
            const response = await fetchTableRows<{ balance: string }>({
              code: contract,
              scope: account,
              table: 'accounts',
              limit: 100,
            });

            response.rows.forEach(row => {
              const parts = row.balance.split(' ');
              const amountStr = parts[0] || '0';
              const symbol = parts[1] || '';
              const amount = parseFloat(amountStr);
              const precision = amountStr.includes('.') ? amountStr.split('.')[1].length : 0;

              if (amount > 0) {
                results.push({
                  symbol,
                  amount,
                  formatted: row.balance,
                  contract,
                  precision,
                });
              }
            });
          } catch (err) {
            // Silently ignore individual contract errors
            console.warn(`Failed to fetch balance from ${contract}:`, err);
          }
        })
      );

      setBalances(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchAllBalances();
  }, [fetchAllBalances]);

  return { balances, loading, error, refetch: fetchAllBalances };
}
