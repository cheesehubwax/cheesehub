import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWax } from '@/context/WaxContext';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { ATOMIC_API } from '@/lib/waxConfig';
import { waxRpcCall } from '@/lib/waxRpcFallback';

export interface ExtraAudioEntry {
  label: string;
  url: string;
  key: string;
}

export interface MusicNFT {
  asset_id: string;
  name: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  audioUrl: string;
  clipUrl?: string;
  videoUrl?: string;
  hasVideo: boolean;
  coverArt: string;
  backCover?: string;
  frontArt?: string;
  backArt?: string;
  additionalImages?: string[];
  extraAudioUrls?: ExtraAudioEntry[];
  duration?: number;
  collection: string;
  schema: string;
  template_id: string;
  mint: string;
}

export interface StackedMusicNFT extends MusicNFT {
  copies: number;
  allAssetIds: string[];
}

function stackMusicNFTs(nfts: MusicNFT[]): StackedMusicNFT[] {
  const templateMap = new Map<string, MusicNFT[]>();
  
  for (const nft of nfts) {
    const key = nft.template_id || nft.asset_id;
    const existing = templateMap.get(key) || [];
    existing.push(nft);
    templateMap.set(key, existing);
  }
  
  return Array.from(templateMap.values()).map(copies => {
    copies.sort((a, b) => {
      const mintA = parseInt(a.mint) || Infinity;
      const mintB = parseInt(b.mint) || Infinity;
      return mintA - mintB;
    });
    
    return {
      ...copies[0],
      copies: copies.length,
      allAssetIds: copies.map(c => c.asset_id),
    };
  });
}

interface CachedMusicData {
  nfts: MusicNFT[];
  timestamp: number;
  assetIds: string[];
}

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

export const CHEESEAMP_GLOBAL_ACCOUNT = 'cheeseamphub';

const CACHE_KEY_PREFIX = 'cheesehub_music_nfts_';
const CACHE_TTL = 5 * 60 * 1000;

function extractIpfsHash(url: string | undefined): string | null {
  if (!url) return null;
  
  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    return url;
  }
  
  const patterns = [
    /ipfs:\/\/(.+)/,
    /\/ipfs\/(.+)/,
    /gateway\.pinata\.cloud\/ipfs\/(.+)/,
    /ipfs\.io\/ipfs\/(.+)/,
    /cloudflare-ipfs\.com\/ipfs\/(.+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function getMediaUrl(field: string | undefined): string {
  if (!field) return '';
  
  if (field.startsWith('http://') || field.startsWith('https://')) {
    return field;
  }
  
  const hash = extractIpfsHash(field);
  if (hash) {
    return `${IPFS_GATEWAYS[0]}${hash}`;
  }
  
  return field;
}

function isMusicNFT(data: Record<string, unknown>): boolean {
  if (data.audio) return true;
  if (data.clip) return true;
  if (data.video) return true;
  return false;
}

const EXTRA_AUDIO_PATTERN = /^(audio\d+|track\d+|fulltrack|full_audio|full_song|bonus_track)$/i;

function extractExtraAudioUrls(allData: Record<string, unknown>): ExtraAudioEntry[] {
  const entries: ExtraAudioEntry[] = [];
  const keys = Object.keys(allData).filter(k => EXTRA_AUDIO_PATTERN.test(k) && allData[k] && typeof allData[k] === 'string');
  
  // Sort so audio1 < audio2 < track1 etc.
  keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  
  for (const key of keys) {
    const url = getMediaUrl(allData[key] as string);
    if (url) {
      // Generate a friendly label
      const num = key.match(/\d+/);
      let label: string;
      if (key.toLowerCase().startsWith('audio') && num) {
        label = `Track ${num[0]}`;
      } else if (key.toLowerCase().startsWith('track') && num) {
        label = `Track ${num[0]}`;
      } else if (key.toLowerCase().includes('full')) {
        label = 'Full Track';
      } else if (key.toLowerCase().includes('bonus')) {
        label = 'Bonus Track';
      } else {
        label = key;
      }
      entries.push({ label, url, key });
    }
  }
  return entries;
}

function getCachedMusicNFTs(owner: string): CachedMusicData | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${owner}`);
    if (!cached) return null;
    
    const data: CachedMusicData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${owner}`);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

function setCachedMusicNFTs(owner: string, nfts: MusicNFT[], assetIds: string[]): void {
  try {
    const data: CachedMusicData = {
      nfts,
      timestamp: Date.now(),
      assetIds,
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${owner}`, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

interface OnChainAsset {
  asset_id: string;
  collection_name: string;
  schema_name: string;
  template_id: number;
}

async function getOwnedAssets(owner: string): Promise<Map<string, OnChainAsset>> {
  const ownedAssets = new Map<string, OnChainAsset>();
  
  try {
    const firstBatch = await waxRpcCall<{
      rows: Array<{ asset_id: string; collection_name: string; schema_name: string; template_id: number }>;
      more: boolean;
      next_key: string;
    }>('/v1/chain/get_table_rows', {
      json: true,
      code: 'atomicassets',
      scope: owner,
      table: 'assets',
      limit: 1000,
    });
    
    if (firstBatch.rows) {
      for (const asset of firstBatch.rows) {
        ownedAssets.set(String(asset.asset_id), {
          asset_id: String(asset.asset_id),
          collection_name: asset.collection_name,
          schema_name: asset.schema_name,
          template_id: asset.template_id,
        });
      }
    }
    
    let more = firstBatch.more;
    let lowerBound = firstBatch.next_key || '';
    
    while (more) {
      const data = await waxRpcCall<{
        rows: Array<{ asset_id: string; collection_name: string; schema_name: string; template_id: number }>;
        more: boolean;
        next_key: string;
      }>('/v1/chain/get_table_rows', {
        json: true,
        code: 'atomicassets',
        scope: owner,
        table: 'assets',
        limit: 1000,
        lower_bound: lowerBound,
      });
      
      if (data.rows) {
        for (const asset of data.rows) {
          ownedAssets.set(String(asset.asset_id), {
            asset_id: String(asset.asset_id),
            collection_name: asset.collection_name,
            schema_name: asset.schema_name,
            template_id: asset.template_id,
          });
        }
      }
      
      more = data.more;
      lowerBound = data.next_key || '';
    }
  } catch (error) {
    console.error('[useMusicNFTs] Error fetching owned assets from blockchain:', error);
  }
  
  return ownedAssets;
}

async function fetchAssetMetadata(assetIds: string[]): Promise<MusicNFT[]> {
  if (assetIds.length === 0) return [];
  
  const batchSize = 50;
  const batches: string[][] = [];
  
  for (let i = 0; i < assetIds.length; i += batchSize) {
    batches.push(assetIds.slice(i, i + batchSize));
  }
  
  const parallelLimit = 5;
  const results: MusicNFT[] = [];
  
  for (let i = 0; i < batches.length; i += parallelLimit) {
    const parallelBatches = batches.slice(i, i + parallelLimit);
    
    const batchResults = await Promise.all(
      parallelBatches.map(async (batch) => {
        const idsParam = batch.join(',');
        
        try {
          const cacheBuster = `&_ts=${Date.now()}`;
          const path = `${ATOMIC_API.paths.assets}?ids=${idsParam}${cacheBuster}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 12000);
          const json = await response.json();
          
          if (json.success && json.data) {
            const musicNfts: MusicNFT[] = [];
            
            for (const asset of json.data) {
              const immutableData = asset.immutable_data || {};
              const mutableData = asset.mutable_data || {};
              const templateData = asset.template?.immutable_data || {};
              const allData = { ...templateData, ...immutableData, ...mutableData };
              
              if (isMusicNFT(allData)) {
                const videoUrl = allData.video ? getMediaUrl(allData.video as string) : undefined;
                const clipUrl = allData.clip ? getMediaUrl(allData.clip as string) : undefined;
                const frontArt = (allData.frontimg || allData.img || allData.image) ? getMediaUrl((allData.frontimg || allData.img || allData.image) as string) : undefined;
                const backArt = (allData.backimg || allData.backcover) ? getMediaUrl((allData.backimg || allData.backcover) as string) : undefined;
                
                // Collect additional images from common NFT art fields
                const artFields = ['img', 'image', 'frontimg', 'backimg', 'backcover', 'artwork', 'cover'];
                const additionalImages: string[] = [];
                for (const field of artFields) {
                  if (allData[field] && typeof allData[field] === 'string') {
                    const url = getMediaUrl(allData[field] as string);
                    if (url && !additionalImages.includes(url)) {
                      additionalImages.push(url);
                    }
                  }
                }

                musicNfts.push({
                  asset_id: asset.asset_id,
                  name: asset.name || allData.name || 'Untitled Track',
                  title: allData.title as string | undefined,
                  artist: allData.artist as string | undefined,
                  album: allData.album as string | undefined,
                  genre: allData.genre as string | undefined,
                  audioUrl: getMediaUrl((allData.audio || allData.clip || allData.video) as string | undefined),
                  clipUrl,
                  videoUrl,
                  hasVideo: !!(videoUrl || clipUrl),
                  coverArt: getMediaUrl((allData.img || allData.image) as string | undefined),
                  backCover: backArt,
                  frontArt,
                  backArt,
                  additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
                  duration: allData.duration ? parseInt(String(allData.duration)) : undefined,
                  collection: asset.collection?.collection_name || '',
                  schema: asset.schema?.schema_name || '',
                  template_id: asset.template?.template_id || '',
                  mint: asset.template_mint || '',
                });
              }
            }
            
            return musicNfts;
          }
        } catch (error) {
          console.error('[useMusicNFTs] Error fetching asset metadata for batch:', error);
        }
        return [];
      })
    );
    
    results.push(...batchResults.flat());
  }
  
  return results;
}

async function fetchApiPage(owner: string, page: number, limit: number): Promise<{
  musicNfts: MusicNFT[];
  hasMore: boolean;
}> {
  const params = new URLSearchParams({
    owner,
    limit: String(limit),
    page: String(page),
    order: 'desc',
    sort: 'asset_id',
  });

  const cacheBuster = `&_ts=${Date.now()}`;
  const path = `${ATOMIC_API.paths.assets}?${params.toString()}${cacheBuster}`;
  
  try {
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
    const json = await response.json();

    if (!json.success || !json.data) {
      return { musicNfts: [], hasMore: false };
    }

    const musicNfts: MusicNFT[] = [];
    
    for (const asset of json.data) {
      const immutableData = asset.immutable_data || {};
      const mutableData = asset.mutable_data || {};
      const templateData = asset.template?.immutable_data || {};
      const allData = { ...templateData, ...immutableData, ...mutableData };
      
      if (isMusicNFT(allData)) {
        const videoUrl = allData.video ? getMediaUrl(allData.video as string) : undefined;
        const clipUrl = allData.clip ? getMediaUrl(allData.clip as string) : undefined;
        const frontArt = (allData.frontimg || allData.img || allData.image) ? getMediaUrl((allData.frontimg || allData.img || allData.image) as string) : undefined;
        const backArt = (allData.backimg || allData.backcover) ? getMediaUrl((allData.backimg || allData.backcover) as string) : undefined;
        
        const artFields = ['img', 'image', 'frontimg', 'backimg', 'backcover', 'artwork', 'cover'];
        const additionalImages: string[] = [];
        for (const field of artFields) {
          if (allData[field] && typeof allData[field] === 'string') {
            const url = getMediaUrl(allData[field] as string);
            if (url && !additionalImages.includes(url)) {
              additionalImages.push(url);
            }
          }
        }

        musicNfts.push({
          asset_id: asset.asset_id,
          name: asset.name || allData.name || 'Untitled Track',
          title: allData.title as string | undefined,
          artist: allData.artist as string | undefined,
          album: allData.album as string | undefined,
          genre: allData.genre as string | undefined,
          audioUrl: getMediaUrl((allData.audio || allData.clip || allData.video) as string | undefined),
          clipUrl,
          videoUrl,
          hasVideo: !!(videoUrl || clipUrl),
          coverArt: getMediaUrl((allData.img || allData.image) as string | undefined),
          backCover: backArt,
          frontArt,
          backArt,
          additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
          duration: allData.duration ? parseInt(String(allData.duration)) : undefined,
          collection: asset.collection?.collection_name || '',
          schema: asset.schema?.schema_name || '',
          template_id: asset.template?.template_id || '',
          mint: asset.template_mint || '',
        });
      }
    }

    return {
      musicNfts,
      hasMore: json.data.length >= limit,
    };
  } catch (err) {
    console.error('[useMusicNFTs] Error fetching page', page, err);
    return { musicNfts: [], hasMore: false };
  }
}

export function useMusicNFTs(overrideAccount?: string) {
  const { accountName: walletAccount } = useWax();
  const owner = overrideAccount || walletAccount;
  const [nfts, setNfts] = useState<MusicNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const abortRef = useRef(false);

  const fetchMusicNFTs = useCallback(async (skipCache = false) => {
    if (!owner || fetchingRef.current) return;
    
    fetchingRef.current = true;
    abortRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      if (!skipCache) {
        const cached = getCachedMusicNFTs(owner);
        if (cached) {
          console.log(`[useMusicNFTs] Using cached data: ${cached.nfts.length} music NFTs`);
          setNfts(cached.nfts);
          setIsLoading(false);
          fetchingRef.current = false;
          return;
        }
      }

      // Phase 1: Parallel fetch - on-chain assets and first API pages
      const [ownedAssetsMap, firstPages] = await Promise.all([
        getOwnedAssets(owner),
        Promise.all([
          fetchApiPage(owner, 1, 100),
          fetchApiPage(owner, 2, 100),
          fetchApiPage(owner, 3, 100),
          fetchApiPage(owner, 4, 100),
          fetchApiPage(owner, 5, 100),
        ]),
      ]);

      if (abortRef.current) return;

      const ownedAssetIds = new Set(ownedAssetsMap.keys());
      console.log(`[useMusicNFTs] On-chain found ${ownedAssetIds.size} total assets for ${owner}`);

      if (ownedAssetIds.size === 0) {
        setNfts([]);
        setIsLoading(false);
        setCachedMusicNFTs(owner, [], []);
        fetchingRef.current = false;
        return;
      }

      // Collect music NFTs from first pages (filter by on-chain ownership)
      const fetchedAssetIds = new Set<string>();
      const allMusicNfts: MusicNFT[] = [];

      for (const pageResult of firstPages) {
        for (const nft of pageResult.musicNfts) {
          if (ownedAssetIds.has(nft.asset_id) && !fetchedAssetIds.has(nft.asset_id)) {
            fetchedAssetIds.add(nft.asset_id);
            allMusicNfts.push(nft);
          }
        }
      }

      // Progressive update
      if (allMusicNfts.length > 0) {
        allMusicNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
        setNfts([...allMusicNfts]);
      }

      if (abortRef.current) return;

      // Phase 2: Continue fetching remaining pages if needed
      const lastPageHadMore = firstPages[firstPages.length - 1].hasMore;
      if (lastPageHadMore) {
        let page = 6;
        const maxPage = 50;
        
        while (page <= maxPage) {
          const pagePromises = [];
          for (let i = 0; i < 5 && page + i <= maxPage; i++) {
            pagePromises.push(fetchApiPage(owner, page + i, 100));
          }
          
          const results = await Promise.all(pagePromises);
          
          if (abortRef.current) return;
          
          let foundAny = false;
          for (const result of results) {
            for (const nft of result.musicNfts) {
              if (ownedAssetIds.has(nft.asset_id) && !fetchedAssetIds.has(nft.asset_id)) {
                fetchedAssetIds.add(nft.asset_id);
                allMusicNfts.push(nft);
                foundAny = true;
              }
            }
            if (!result.hasMore) break;
          }
          
          if (foundAny) {
            allMusicNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
            setNfts([...allMusicNfts]);
          }
          
          if (results.every(r => !r.hasMore || r.musicNfts.length === 0)) break;
          
          page += 5;
        }
      }

      if (abortRef.current) return;

      // Phase 3: For any assets we haven't checked yet, fetch by ID to find more music NFTs
      const uncheckedAssetIds = Array.from(ownedAssetIds).filter(id => !fetchedAssetIds.has(id));
      
      if (uncheckedAssetIds.length > 0 && uncheckedAssetIds.length <= 500) {
        console.log(`[useMusicNFTs] Checking ${uncheckedAssetIds.length} unchecked assets for music NFTs`);
        const additionalMusicNfts = await fetchAssetMetadata(uncheckedAssetIds);
        
        if (additionalMusicNfts.length > 0) {
          allMusicNfts.push(...additionalMusicNfts);
          allMusicNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
          setNfts([...allMusicNfts]);
        }
      }

      console.log(`[useMusicNFTs] Found ${allMusicNfts.length} music NFTs`);
      setCachedMusicNFTs(
        owner,
        allMusicNfts,
        allMusicNfts.map(n => n.asset_id)
      );
    } catch (err) {
      console.error('[useMusicNFTs] Failed to fetch music NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch music NFTs');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [owner]);

  useEffect(() => {
    if (owner) {
      fetchMusicNFTs();
    } else {
      setNfts([]);
    }
  }, [owner, fetchMusicNFTs]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const refetch = useCallback(() => {
    fetchMusicNFTs(true);
  }, [fetchMusicNFTs]);

  const stackedNfts = useMemo(() => {
    return stackMusicNFTs(nfts);
  }, [nfts]);

  const collections = useMemo(() => {
    const collectionMap = new Map<string, number>();
    nfts.forEach(nft => {
      const count = collectionMap.get(nft.collection) || 0;
      collectionMap.set(nft.collection, count + 1);
    });
    return Array.from(collectionMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [nfts]);

  const artists = useMemo(() => {
    const artistMap = new Map<string, number>();
    nfts.forEach(nft => {
      if (nft.artist) {
        const count = artistMap.get(nft.artist) || 0;
        artistMap.set(nft.artist, count + 1);
      }
    });
    return Array.from(artistMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [nfts]);

  return {
    nfts,
    stackedNfts,
    isLoading,
    error,
    refetch,
    collections,
    artists,
    totalTracks: nfts.length,
  };
}