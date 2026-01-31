import { useState, useCallback } from 'react';
import { useWax } from '@/context/WaxContext';
import type { NFTDrop, SelectedPrice } from '@/types/drop';

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export function usePurchaseDrop() {
  const { session, accountName } = useWax();
  const [purchasing, setPurchasing] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);

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

      if (drop.dropSource === 'nfthive' && drop.dropId) {
        // Use the context's claimDrop method for NFTHive drops
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
        });

        transactionId = txId.resolved?.transaction.id?.toString();
      } else if (drop.dropSource === 'sale' && drop.saleId) {
        // Purchase from AtomicMarket sale
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
        });

        transactionId = txId.resolved?.transaction.id?.toString();
      } else {
        throw new Error('Unknown drop source');
      }

      const success = { success: true, transactionId };
      setResult(success);
      return success;
    } catch (err) {
      const error = {
        success: false,
        error: err instanceof Error ? err.message : 'Purchase failed',
      };
      setResult(error);
      return error;
    } finally {
      setPurchasing(false);
    }
  }, [session, accountName]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return { purchaseDrop, purchasing, result, clearResult };
}
