import { useCallback } from 'react';
import { Session } from '@wharfkit/session';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { useToast } from '@/hooks/use-toast';
import { useTransactionSuccess } from '@/context/TransactionSuccessContext';

interface TransactionOptions {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

interface TransactionResult {
  success: boolean;
  txId: string | null;
  error?: Error;
}

/**
 * A hook that wraps WAX transactions with automatic modal cleanup.
 * This prevents stuck Anchor/WharfKit modals after transaction failures or cancellations.
 *
 * Usage:
 * const { executeTransaction } = useWaxTransaction(session);
 * const result = await executeTransaction(actions, { successTitle: 'Done!' });
 */
export function useWaxTransaction(session: Session | null) {
  const { toast } = useToast();
  const { showSuccess } = useTransactionSuccess();

  const executeTransaction = useCallback(async (
    actions: any[],
    options: TransactionOptions = {}
  ): Promise<TransactionResult> => {
    const {
      successTitle = 'Transaction Successful',
      successDescription,
      errorTitle = 'Transaction Failed',
      showSuccessToast = true,
      showErrorToast = true,
    } = options;

    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return { success: false, txId: null };
    }

    try {
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      if (showSuccessToast) {
        toast({
          title: successTitle,
          description: successDescription,
        });
      }

      return { success: true, txId };
    } catch (error) {
      console.error('Transaction failed:', error);

      // Immediately clean up any stuck modals
      closeWharfkitModals();

      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      const isExpired = errorMessage.toLowerCase().includes('expired');
      const isCancelled = errorMessage.toLowerCase().includes('cancel') ||
                          errorMessage.toLowerCase().includes('rejected');

      if (showErrorToast) {
        toast({
          title: isExpired ? 'Request Expired' : (isCancelled ? 'Transaction Cancelled' : errorTitle),
          description: isExpired
            ? 'The signing request timed out. Please try again.'
            : errorMessage,
          variant: 'destructive',
        });
      }

      return { success: false, txId: null, error: error instanceof Error ? error : new Error(errorMessage) };
    } finally {
      // Aggressive cleanup with small delay to catch any lingering modals
      setTimeout(() => closeWharfkitModals(), 100);
      setTimeout(() => closeWharfkitModals(), 500);
    }
  }, [session, toast]);

  /**
   * Execute a raw transaction using session.transact directly.
   * For cases where you need the full result object.
   */
  const executeRawTransaction = useCallback(async (
    actions: any[],
    options: TransactionOptions = {}
  ) => {
    const {
      errorTitle = 'Transaction Failed',
      showErrorToast = true,
    } = options;

    if (!session) {
      throw new Error('Wallet not connected');
    }

    try {
      return await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
    } catch (error) {
      console.error('Transaction failed:', error);
      closeWharfkitModals();

      if (showErrorToast) {
        const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      }

      throw error;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
      setTimeout(() => closeWharfkitModals(), 500);
    }
  }, [session, toast]);

  return { executeTransaction, executeRawTransaction };
}
