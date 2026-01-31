import { useState, useEffect, useCallback } from 'react';
import { fetchCheeseDrops, fetchCollectionSales, getImageUrl } from '@/services/atomicApi';
import { CHEESE_CONFIG } from '@/lib/waxConfig';
import type { NFTDrop, AtomicSale } from '@/types/drop';

export interface DropsLoaderResult {
  drops: NFTDrop[];
  sales: NFTDrop[];
  allItems: NFTDrop[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDropsLoader(): DropsLoaderResult {
  const [drops, setDrops] = useState<NFTDrop[]>([]);
  const [sales, setSales] = useState<NFTDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch drops and sales in parallel
      const [dropsData, salesData] = await Promise.all([
        fetchCheeseDrops(),
        fetchCollectionSales(CHEESE_CONFIG.collectionName, 50),
      ]);

      setDrops(dropsData);

      // Convert sales to NFTDrop format
      const formattedSales: NFTDrop[] = salesData.map((sale: AtomicSale): NFTDrop => {
        const asset = sale.assets?.[0];
        const template = asset?.template;
        const immutableData = template?.immutable_data || asset?.immutable_data || {};

        return {
          id: `sale-${sale.sale_id}`,
          saleId: sale.sale_id,
          templateId: template?.template_id,
          collectionName: sale.collection_name,
          name: immutableData.name || asset?.name || `Sale #${sale.sale_id}`,
          description: immutableData.description || '',
          image: getImageUrl(immutableData.img || immutableData.image),
          price: parseFloat(sale.listing_price) || 0,
          totalSupply: 1,
          remaining: 1,
          seller: sale.seller,
          attributes: [],
          dropSource: 'sale',
          currency: sale.listing_symbol,
          tokenContract: sale.price?.token_contract,
          listingPrice: sale.listing_price,
        };
      });

      setSales(formattedSales);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    drops,
    sales,
    allItems: [...drops, ...sales],
    loading,
    error,
    refetch: fetchAll,
  };
}
