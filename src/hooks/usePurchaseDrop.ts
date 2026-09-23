import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import { getTransactPlugins, closeWharfkitModals } from '@/lib/wharfKit';
import { clearDropsCache } from '@/hooks/useDropsLoader';
import type { NFTDrop, SelectedPrice } from '@/types/drop';

/** Broadcast so any open drop view re-reads its own on-chain numbers. */
export const DROP_PURCHASED_EVENT = 'cheesedrop:purchased';

/** Chain state needs a block or two before the claimed counters move. */
const REFRESH_DELAYS_MS = [0, 2500, 6000];

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export function usePurchaseDrop() {
  const { session, accountName, refreshBalance } = useWax();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);

  /** Re-read drop supply/claim counters after a purchase, allowing for block time. */
  const refreshDropData = useCallback(() => {
    clearDropsCache();
    for (const delay of REFRESH_DELAYS_MS) {
      setTimeout(() => {
        clearDropsCache();
        queryClient.invalidateQueries({ queryKey: ['drops-raw'] });
        queryClient.invalidateQueries({ queryKey: ['cheese-drop-stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-drop-purchases'] });
        window.dispatchEvent(new CustomEvent(DROP_PURCHASED_EVENT));
      }, delay);
    }
  }, [queryClient]);


  const purchaseDrop = useCallback(async (
    drop: NFTDrop,
    quantity: number = 1,
    selectedPrice?: SelectedPrice
  ): Promise<PurchaseResult> => {
    if (!session || !accountName) {
      const error = { success: false, error: 'Wallet not connected' };
      setResult(error);
      return error;
    }

    setPurchasing(true);
    setResult(null);

    try {
      let transactionId: string | undefined;
      const transactOptions = { transactPlugins: getTransactPlugins(session) };

      if (drop.dropSource === 'nfthive' && drop.dropId) {
        const price = selectedPrice || {
          price: drop.price,
          currency: drop.currency || 'CHEESE',
          tokenContract: drop.tokenContract || 'cheeseburger',
          precision: 4,
          listingPrice: drop.listingPrice || `${drop.price.toFixed(4)} CHEESE`,
        };

        const txId = await session.transact({
          actions: [{
            account: price.tokenContract,
            name: 'transfer',
            authorization: [session.permissionLevel],
            data: {
              from: accountName,
              to: 'nfthivedrops',
              quantity: `${(price.price * quantity).toFixed(price.precision)} ${price.currency}`,
              memo: 'deposit',
            },
          }, {
            account: 'nfthivedrops',
            name: 'claimdrop',
            authorization: [session.permissionLevel],
            data: {
              claimer: accountName,
              drop_id: parseInt(drop.dropId),
              amount: quantity,
              intended_delphi_median: 0,
              referrer: '',
              country: '',
              currency: `${price.precision},${price.currency}`,
            },
          }],
        }, transactOptions);

        transactionId = txId.resolved?.transaction.id?.toString();
      } else if (drop.dropSource === 'sale' && drop.saleId) {
        const price = selectedPrice || {
          price: drop.price,
          currency: drop.currency || 'WAX',
          tokenContract: drop.tokenContract || 'eosio.token',
          precision: 8,
          listingPrice: drop.listingPrice || `${drop.price.toFixed(8)} WAX`,
        };

        const txId = await session.transact({
          actions: [{
            account: 'atomicmarket',
            name: 'purchasesale',
            authorization: [session.permissionLevel],
            data: {
              buyer: accountName,
              sale_id: parseInt(drop.saleId),
              intended_delphi_median: 0,
              taker_marketplace: '',
            },
          }],
        }, transactOptions);

        transactionId = txId.resolved?.transaction.id?.toString();
      } else {
        throw new Error('Unknown drop source');
      }

      refreshBalance?.();
      refreshDropData();
      const success = { success: true, transactionId };
      setResult(success);
      return success;
    } catch (err) {
      closeWharfkitModals();
      const error = {
        success: false,
        error: err instanceof Error ? err.message : 'Purchase failed',
      };
      setResult(error);
      return error;
    } finally {
      setPurchasing(false);
      closeWharfkitModals();
    }
  }, [session, accountName, refreshBalance, refreshDropData]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return { purchaseDrop, purchasing, result, clearResult };
}
