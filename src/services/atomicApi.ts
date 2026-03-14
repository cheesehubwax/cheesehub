import { ATOMIC_API, CHEESE_CONFIG, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import type { NFTDrop, AtomicSale, AtomicTemplate, NFTHiveDrop } from '@/types/drop';

// Use reliable IPFS gateways with fallbacks
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function getIpfsUrl(hash: string): string {
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

function getImageUrl(img: string | undefined): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  if (img.startsWith('ipfs://')) return getIpfsUrl(img.replace('ipfs://', ''));
  if (img.startsWith('Qm') || img.startsWith('bafy') || img.startsWith('bafk')) return getIpfsUrl(img);
  if (img.startsWith('/ipfs/')) return `https://ipfs.io${img}`;
  if (/^[a-zA-Z0-9]{46,}$/.test(img)) return getIpfsUrl(img);
  return img || '/placeholder.svg';
}

export async function fetchCheeseDrops(): Promise<NFTDrop[]> {
  try {
    const response = await fetch(
      `${NFTHIVE_CONFIG.apiUrl}/drops?currency=${CHEESE_CONFIG.tokenSymbol}&collection=${CHEESE_CONFIG.collectionName}&limit=50`
    );

    if (!response.ok) throw new Error(`NFT Hive API error: ${response.status}`);

    const drops: NFTHiveDrop[] = await response.json();

    return drops.map((drop): NFTDrop => {
      const templateData = drop.templatesToMint?.[0];
      const immutableData: Record<string, string> = {};
      templateData?.immutableData?.forEach(item => {
        immutableData[item.key] = item.value[1];
      });

      return {
        id: String(drop.dropId),
        name: drop.displayData?.name || templateData?.name || `Drop #${drop.dropId}`,
        description: drop.displayData?.description || '',
        image: getImageUrl(immutableData.img || immutableData.image),
        collectionName: drop.collection?.collectionName || '',
        price: drop.price || 0,
        totalSupply: drop.maxClaimable,
        remaining: drop.maxClaimable - (drop.numClaimed || 0),
        attributes: [],
        dropSource: 'nfthive',
        dropId: String(drop.dropId),
        currency: drop.currency,
      };
    });
  } catch (error) {
    console.error('Failed to fetch CHEESE drops:', error);
    return [];
  }
}

export async function fetchDropById(dropId: string): Promise<NFTDrop | null> {
  try {
    const response = await fetch(`${NFTHIVE_CONFIG.apiUrl}/drops/${dropId}`);
    if (!response.ok) throw new Error(`NFT Hive API error: ${response.status}`);

    const drop: NFTHiveDrop = await response.json();
    const templateData = drop.templatesToMint?.[0];
    const immutableData: Record<string, string> = {};
    templateData?.immutableData?.forEach(item => {
      immutableData[item.key] = item.value[1];
    });

    return {
      id: String(drop.dropId),
      name: drop.displayData?.name || templateData?.name || `Drop #${drop.dropId}`,
      description: drop.displayData?.description || '',
      image: getImageUrl(immutableData.img || immutableData.image),
      collectionName: drop.collection?.collectionName || '',
      price: drop.price || 0,
      totalSupply: drop.maxClaimable,
      remaining: drop.maxClaimable - (drop.numClaimed || 0),
      attributes: [],
      dropSource: 'nfthive',
      dropId: String(drop.dropId),
      currency: drop.currency,
    };
  } catch (error) {
    console.error(`Failed to fetch drop ${dropId}:`, error);
    return null;
  }
}

export async function fetchTemplateById(collectionName: string, templateId: string): Promise<AtomicTemplate | null> {
  try {
    const response = await fetchWithFallback(
      ATOMIC_API.baseUrls,
      `${ATOMIC_API.paths.templates}/${collectionName}/${templateId}`
    );
    const data = await response.json();
    return data.success && data.data ? data.data : null;
  } catch (error) {
    console.error(`Failed to fetch template ${templateId}:`, error);
    return null;
  }
}

export async function fetchCollectionSales(collectionName: string, limit = 20): Promise<AtomicSale[]> {
  try {
    const response = await fetchWithFallback(
      ATOMIC_API.baseUrls,
      `${ATOMIC_API.paths.sales}?collection_name=${collectionName}&state=1&order=desc&sort=created&limit=${limit}`
    );
    const data = await response.json();
    return data.success && data.data ? data.data : [];
  } catch (error) {
    console.error(`Failed to fetch sales for ${collectionName}:`, error);
    return [];
  }
}

export async function fetchUserAssets(account: string, collectionName?: string): Promise<unknown[]> {
  try {
    let url = `${ATOMIC_API.paths.assets}?owner=${account}&limit=100`;
    if (collectionName) url += `&collection_name=${collectionName}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, url);
    const data = await response.json();
    return data.success && data.data ? data.data : [];
  } catch (error) {
    console.error(`Failed to fetch assets for ${account}:`, error);
    return [];
  }
}

export async function fetchTemplatesBatch(
  requests: { templateId: string; collectionName: string }[]
): Promise<Map<string, { name: string; image: string; isVideo?: boolean }>> {
  const results = new Map<string, { name: string; image: string; isVideo?: boolean }>();

  // Batch by collection to reduce API calls
  const byCollection = new Map<string, string[]>();
  for (const req of requests) {
    const list = byCollection.get(req.collectionName) || [];
    list.push(req.templateId);
    byCollection.set(req.collectionName, list);
  }

  for (const [collectionName, templateIds] of byCollection) {
    try {
      const ids = templateIds.join(',');
      const response = await fetchWithFallback(
        ATOMIC_API.baseUrls,
        `${ATOMIC_API.paths.templates}?collection_name=${collectionName}&ids=${ids}&limit=100`
      );
      const data = await response.json();
      if (data.success && data.data) {
        for (const template of data.data) {
          const key = `${collectionName}:${template.template_id}`;
          const immData = template.immutable_data || {};
          const img = immData.img || immData.image || immData.video || '';
          const isVideo = !!(immData.video && !immData.img && !immData.image);
          results.set(key, {
            name: immData.name || `#${template.template_id}`,
            image: getImageUrl(img),
            isVideo,
          });
        }
      }
    } catch (error) {
      console.error(`[fetchTemplatesBatch] Failed for ${collectionName}:`, error);
    }
  }

  return results;
}

export { getImageUrl, getIpfsUrl };
