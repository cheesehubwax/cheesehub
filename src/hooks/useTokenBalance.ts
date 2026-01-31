import { useState, useEffect, useCallback } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';

export interface TokenBalance {
  symbol: string;
  amount: number;
  formatted: string;
  contract: string;
}

export function useTokenBalance(
  account: string | undefined,
  tokenContract: string,
  tokenSymbol: string
) {
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!account) {
      setBalance(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchTableRows<{ balance: string }>({
        code: tokenContract,
        scope: account,
        table: 'accounts',
        limit: 100,
      });

      const tokenRow = response.rows.find(row => {
        const [, symbol] = row.balance.split(' ');
        return symbol === tokenSymbol;
      });

      if (tokenRow) {
        const [amountStr, symbol] = tokenRow.balance.split(' ');
        const amount = parseFloat(amountStr);
        setBalance({
          symbol,
          amount,
          formatted: tokenRow.balance,
          contract: tokenContract,
        });
      } else {
        setBalance({
          symbol: tokenSymbol,
          amount: 0,
          formatted: `0 ${tokenSymbol}`,
          contract: tokenContract,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [account, tokenContract, tokenSymbol]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}
