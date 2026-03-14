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
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('[fetchCheeseDrops] Failed:', error);
    return [];
  }
}

export async function fetchCheeseSales(): Promise<AtomicSale[]> {
  try {
    const response = await fetchWithFallback(
      ATOMIC_API.baseUrls,
      `${ATOMIC_API.paths.sales}?collection_name=${CHEESE_CONFIG.collectionName}&state=1&limit=50&order=desc&sort=created`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[fetchCheeseSales] Failed:', error);
    return [];
  }
}

export async function fetchNFTHiveDrops(): Promise<NFTHiveDrop[]> {
  try {
    const response = await fetch(
      `${NFTHIVE_CONFIG.apiUrl}/drops?collection=${CHEESE_CONFIG.collectionName}&limit=50`
    );
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('[fetchNFTHiveDrops] Failed:', error);
    return [];
  }
}

export async function fetchTemplateDetails(collectionName: string, templateId: string): Promise<AtomicTemplate | null> {
  try {
    const response = await fetchWithFallback(
      ATOMIC_API.baseUrls,
      `${ATOMIC_API.paths.templates}/${collectionName}/${templateId}`
    );
    const data = await response.json();
    if (data.success && data.data) {
      const immData = data.data.immutable_data || {};
      return {
        template_id: data.data.template_id,
        contract: data.data.contract || '',
        name: immData.name || `Template #${templateId}`,
        collection: { collection_name: collectionName, name: immData.name || '', img: getImageUrl(immData.img || '') },
        max_supply: data.data.max_supply || '0',
        issued_supply: data.data.issued_supply || '0',
        is_transferable: data.data.is_transferable ?? true,
        is_burnable: data.data.is_burnable ?? true,
        schema: data.data.schema || { schema_name: '' },
        immutable_data: immData,
        created_at_time: data.data.created_at_time || '',
        created_at_block: data.data.created_at_block || '',
      };
    }
    return null;
  } catch (error) {
    console.error('[fetchTemplateDetails] Failed:', error);
    return null;
  }
}

interface TemplateRequest {
  collectionName: string;
  templateId: string;
}

export async function fetchTemplatesBatch(
  requests: TemplateRequest[]
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

// Fetch user's NFTs filtered by specific collections and schemas (for DAO voting/staking)
export interface EligibleNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
}

const ATOMIC_AA_ENDPOINTS = [
  'https://aa.wax.blacklusion.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://wax.api.atomicassets.io',
];

export async function fetchUserNFTsBySchema(
  userAccount: string,
  collections: string[],
  schemas: string[]
): Promise<EligibleNFT[]> {
  const eligibleNFTs: EligibleNFT[] = [];

  // Build query params for each collection/schema pair
  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];
    const schema = schemas[i];
    if (!collection || !schema) continue;

    let fetched = false;
    for (const baseUrl of ATOMIC_AA_ENDPOINTS) {
      if (fetched) break;
      try {
        const response = await fetch(
          `${baseUrl}/atomicassets/v1/assets?owner=${userAccount}&collection_name=${collection}&schema_name=${schema}&limit=1000`
        );
        if (!response.ok) continue;

        const data = await response.json();
        if (data.success && data.data) {
          for (const asset of data.data) {
            const assetData = asset.data || {};
            let image = assetData.img || assetData.image || "";
            if (image && !image.startsWith("http")) {
              if (image.startsWith("Qm") || image.startsWith("bafy")) {
                image = `https://ipfs.io/ipfs/${image}`;
              }
            }

            eligibleNFTs.push({
              asset_id: asset.asset_id,
              name: assetData.name || asset.name || `NFT #${asset.asset_id}`,
              image,
              collection: asset.collection?.collection_name || collection,
              schema: asset.schema?.schema_name || schema,
            });
          }
          fetched = true;
        }
      } catch (error) {
        console.log(`[fetchUserNFTsBySchema] ${baseUrl} failed, trying next...`);
      }
    }
  }

  return eligibleNFTs;
}

// Fetch user assets from a specific collection
export async function fetchUserAssets(account: string, collectionName: string): Promise<any[]> {
  for (const baseUrl of ATOMIC_AA_ENDPOINTS) {
    try {
      const response = await fetch(
        `${baseUrl}/atomicassets/v1/assets?owner=${account}&collection_name=${collectionName}&limit=1000`
      );
      if (!response.ok) continue;
      const data = await response.json();
      if (data.success && data.data) return data.data;
    } catch {
      continue;
    }
  }
  return [];
}

// Fetch sales for a collection
export async function fetchCollectionSales(collectionName: string, limit = 50): Promise<AtomicSale[]> {
  try {
    const response = await fetchWithFallback(
      ATOMIC_API.baseUrls,
      `${ATOMIC_API.paths.sales}?collection_name=${collectionName}&state=1&limit=${limit}&order=desc&sort=created`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[fetchCollectionSales] Failed:', error);
    return [];
  }
}

// Alias for fetchTemplateDetails used by useEnrichDrops
export const fetchTemplateById = fetchTemplateDetails;

// Fetch a single drop by ID from NftHive
export async function fetchDropById(dropId: string): Promise<NFTDrop | null> {
  try {
    const response = await fetch(
      `${NFTHIVE_CONFIG.apiUrl}/drops/${dropId}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error('[fetchDropById] Failed:', error);
    return null;
  }
}

export { getImageUrl, getIpfsUrl };
