import { useState, useEffect, useCallback } from 'react';
import { fetchUserAssets, getImageUrl } from '@/services/atomicApi';

export interface UserNFT {
  assetId: string;
  name: string;
  image: string;
  collectionName: string;
  schemaName: string;
  templateId: string | null;
  data: Record<string, string>;
}

export function useUserNFTs(account: string | undefined, collectionName?: string) {
  const [nfts, setNfts] = useState<UserNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNFTs = useCallback(async () => {
    if (!account) {
      setNfts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const assets = await fetchUserAssets(account, collectionName);

      const formattedNFTs: UserNFT[] = (assets as Array<{
        asset_id: string;
        name: string;
        data: Record<string, string>;
        collection: { collection_name: string };
        schema: { schema_name: string };
        template: { template_id: string } | null;
      }>).map(asset => ({
        assetId: asset.asset_id,
        name: asset.name || 'Unnamed NFT',
        image: getImageUrl(asset.data?.img || asset.data?.image),
        collectionName: asset.collection?.collection_name || '',
        schemaName: asset.schema?.schema_name || '',
        templateId: asset.template?.template_id || null,
        data: asset.data || {},
      }));

      setNfts(formattedNFTs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch NFTs');
    } finally {
      setLoading(false);
    }
  }, [account, collectionName]);

  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  return { nfts, loading, error, refetch: fetchNFTs };
}
