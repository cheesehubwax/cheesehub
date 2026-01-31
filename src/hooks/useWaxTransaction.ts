import { useState, useCallback } from 'react';
import { useWax } from '@/context/WaxContext';

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface TransactionAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, unknown>;
}

export function useWaxTransaction() {
  const { session, accountName } = useWax();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransactionResult | null>(null);

  const transact = useCallback(async (
    actions: TransactionAction | TransactionAction[]
  ): Promise<TransactionResult> => {
    if (!session || !accountName) {
      const error = { success: false, error: 'Wallet not connected' };
      setResult(error);
      return error;
    }

    setLoading(true);
    setResult(null);

    try {
      const actionsArray = Array.isArray(actions) ? actions : [actions];

      const tx = await session.transact({ actions: actionsArray });
      const transactionId = tx.resolved?.transaction.id?.toString();

      const success = { success: true, transactionId };
      setResult(success);
      return success;
    } catch (err) {
      const error = {
        success: false,
        error: err instanceof Error ? err.message : 'Transaction failed',
      };
      setResult(error);
      return error;
    } finally {
      setLoading(false);
    }
  }, [session, accountName]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const buildAction = useCallback((
    contract: string,
    action: string,
    data: Record<string, unknown>
  ): TransactionAction => {
    if (!accountName) throw new Error('Wallet not connected');

    return {
      account: contract,
      name: action,
      authorization: [{ actor: accountName, permission: 'active' }],
      data,
    };
  }, [accountName]);

  return { transact, loading, result, clearResult, buildAction };
}
