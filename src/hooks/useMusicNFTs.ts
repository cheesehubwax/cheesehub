import { useState, useEffect, useCallback } from 'react';
import { fetchUserAssets, getImageUrl } from '@/services/atomicApi';

export interface MusicNFT {
  assetId: string;
  name: string;
  image: string;
  audio: string;
  artist: string;
  collectionName: string;
  templateId: string | null;
}

// Known music NFT collections on WAX
const MUSIC_COLLECTIONS = [
  'cheesenftwax',
  'musiconwax11',
  'nftmusicvibe',
];

export function useMusicNFTs(account: string | undefined) {
  const [musicNFTs, setMusicNFTs] = useState<MusicNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMusicNFTs = useCallback(async () => {
    if (!account) {
      setMusicNFTs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch from all music collections
      const allAssets = await Promise.all(
        MUSIC_COLLECTIONS.map(collection => fetchUserAssets(account, collection))
      );

      const flatAssets = allAssets.flat() as Array<{
        asset_id: string;
        name: string;
        data: Record<string, string>;
        collection: { collection_name: string };
        template: { template_id: string } | null;
      }>;

      // Filter to only assets with audio files
      const musicAssets: MusicNFT[] = flatAssets
        .filter(asset => {
          const data = asset.data || {};
          return data.audio || data.music || data.song || data.mp3;
        })
        .map(asset => ({
          assetId: asset.asset_id,
          name: asset.name || 'Unknown Track',
          image: getImageUrl(asset.data?.img || asset.data?.image),
          audio: getImageUrl(asset.data?.audio || asset.data?.music || asset.data?.song || asset.data?.mp3),
          artist: asset.data?.artist || asset.data?.creator || 'Unknown Artist',
          collectionName: asset.collection?.collection_name || '',
          templateId: asset.template?.template_id || null,
        }));

      setMusicNFTs(musicAssets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch music NFTs');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchMusicNFTs();
  }, [fetchMusicNFTs]);

  return { musicNFTs, loading, error, refetch: fetchMusicNFTs };
}
