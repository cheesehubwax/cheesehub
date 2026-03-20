import { ATOMIC_API, CHEESE_CONFIG, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import type { NFTDrop, AtomicSale, AtomicTemplate, AtomicDrop, NFTHiveDrop, DropPrice } from '@/types/drop';

// =============================================================================
// Global Image Preload Tracking
// =============================================================================
const preloadingImages = new Map<string, Promise<boolean>>();
const loadedImages = new Set<string>();

export function preloadImage(url: string): Promise<boolean> {
  if (!url || url.includes('placeholder')) return Promise.resolve(false);
  if (loadedImages.has(url)) return Promise.resolve(true);
  if (preloadingImages.has(url)) return preloadingImages.get(url)!;
  
  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        loadedImages.add(url);
        preloadingImages.delete(url);
        resolve(true);
      } else {
        preloadingImages.delete(url);
        resolve(false);
      }
    };
    img.onerror = () => {
      preloadingImages.delete(url);
      resolve(false);
    };
    img.src = url;
  });
  
  preloadingImages.set(url, promise);
  return promise;
}

export function isImageLoaded(url: string): boolean {
  return loadedImages.has(url);
}

export function isImagePreloading(url: string): boolean {
  return preloadingImages.has(url);
}

export function waitForPreload(url: string): Promise<boolean> {
  if (loadedImages.has(url)) return Promise.resolve(true);
  if (preloadingImages.has(url)) return preloadingImages.get(url)!;
  return Promise.resolve(false);
}

import { IPFS_GATEWAYS, getIpfsUrl } from '@/lib/ipfsGateways';

export function getImageUrl(img: string | undefined): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  if (img.startsWith('ipfs://')) {
    const hash = img.replace('ipfs://', '');
    return getIpfsUrl(hash);
  }
  if (img.startsWith('Qm') || img.startsWith('bafy') || img.startsWith('bafk')) return getIpfsUrl(img);
  if (img.startsWith('/ipfs/')) return `https://ipfs.io${img}`;
  if (/^[a-zA-Z0-9]{46,}$/.test(img)) return getIpfsUrl(img);
  return img || '/placeholder.svg';
}

function getMediaUrl(data: Record<string, string>): { url: string; isVideo: boolean } {
  const imageField = data.img || data.image;
  if (imageField) return { url: getImageUrl(imageField), isVideo: false };
  const videoField = data.video;
  if (videoField) return { url: getImageUrl(videoField), isVideo: true };
  return { url: '/placeholder.svg', isVideo: false };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// =============================================================================
// Template Fetching
// =============================================================================

export async function fetchTemplatesBatch(
  requests: { templateId: string; collectionName: string }[]
): Promise<Map<string, { name: string; image: string; isVideo?: boolean }>> {
  const uniqueRequests = new Map<string, { templateId: string; collectionName: string }>();
  for (const req of requests) {
    if (!uniqueRequests.has(req.templateId)) {
      uniqueRequests.set(req.templateId, req);
    }
  }

  const results = new Map<string, { name: string; image: string; isVideo?: boolean }>();
  const allIds = Array.from(uniqueRequests.keys());
  
  console.log(`[NFTHive Batch] Fetching ${allIds.length} unique templates`);

  const chunks = chunkArray(allIds, 100);
  
  for (const chunk of chunks) {
    try {
      const params = new URLSearchParams({
        ids: chunk.join(','),
        limit: '100',
      });
      const path = `${ATOMIC_API.paths.templates}?${params}`;
      const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
      const json = await response.json();

      if (json.success && json.data) {
        for (const template of json.data) {
          const data = template.immutable_data || {};
          const collectionName = template.collection?.collection_name || '';
          const key = `${collectionName}:${template.template_id}`;
          const media = getMediaUrl(data);
          results.set(key, {
            name: data.name || template.name || `Template #${template.template_id}`,
            image: media.url,
            isVideo: media.isVideo,
          });
        }
      }
    } catch (error) {
      console.warn(`[NFTHive Batch] Batch fetch failed:`, error);
    }
  }

  // Fallback for missing templates
  const missingTemplates = Array.from(uniqueRequests.values()).filter(req => {
    const key = `${req.collectionName}:${req.templateId}`;
    return !results.has(key);
  });

  if (missingTemplates.length > 0) {
    console.log(`[NFTHive Batch] Fetching ${missingTemplates.length} missing templates in parallel`);
    
    await Promise.allSettled(
      missingTemplates.map(async ({ templateId, collectionName }) => {
        try {
          const data = await fetchTemplateById(templateId, collectionName);
          if (data && data.image && !data.image.includes('placeholder')) {
            const key = `${collectionName}:${templateId}`;
            results.set(key, { name: data.name, image: data.image });
          }
        } catch {
          // Ignore individual fetch errors
        }
      })
    );
  }

  console.log(`[NFTHive Batch] Successfully fetched ${results.size} templates`);
  return results;
}

function extractRarity(data: Record<string, string>): string {
  const rarityKeys = ['rarity', 'Rarity', 'RARITY', 'tier', 'Tier'];
  for (const key of rarityKeys) {
    if (data[key]) return data[key];
  }
  return 'Common';
}

function buildAttributes(data: Record<string, string>): { trait: string; value: string }[] {
  const excludeKeys = ['name', 'img', 'video', 'description', 'image'];
  return Object.entries(data)
    .filter(([key]) => !excludeKeys.includes(key.toLowerCase()))
    .map(([trait, value]) => ({ trait, value: String(value) }))
    .slice(0, 6);
}

// =============================================================================
// On-chain NFTHive drops
// =============================================================================

interface OnChainNFTHiveDrop {
  drop_id: number;
  authorized_account: string;
  collection_name: string;
  assets_to_mint: Array<{
    template_id: number;
    tokens_to_back: unknown[];
    pool_id: number;
  }>;
  listing_price: string;
  settlement_symbol: string;
  price_recipient: string;
  fee_rate: string;
  auth_required: number;
  is_hidden: number;
  max_claimable: number;
  current_claimed: number;
  account_limit: number;
  account_limit_cooldown: number;
  start_time: number;
  end_time: number;
  display_data: string;
}

interface OnChainDropPrice {
  drop_id: number;
  listing_prices: string[];
}

function parseListingPrice(listingPrice: string): { price: number; currency: string } {
  const parts = listingPrice.trim().split(' ');
  if (parts.length >= 2) {
    return { price: parseFloat(parts[0]) || 0, currency: parts[1] || 'WAX' };
  }
  return { price: 0, currency: 'WAX' };
}

async function fetchDropPrices(dropId: string | number): Promise<DropPrice[]> {
  try {
    const numericDropId = typeof dropId === 'string' ? parseInt(dropId) : dropId;
    
    const response = await fetch('https://wax.eosusa.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'dropprices',
        lower_bound: numericDropId.toString(),
        upper_bound: numericDropId.toString(),
        limit: 1,
      }),
    });
    
    const data = await response.json();
    const rows: OnChainDropPrice[] = data.rows || [];
    
    if (!rows.length || rows[0].drop_id !== numericDropId) return [];
    
    return rows[0].listing_prices.map((priceStr): DropPrice => {
      const { price, currency } = parseListingPrice(priceStr);
      return { price, currency, listingPrice: priceStr };
    });
  } catch (error) {
    console.warn('[NFTHive] Failed to fetch drop prices:', error);
    return [];
  }
}

function rawDropToNFTDrop(drop: OnChainNFTHiveDrop): NFTDrop {
  const templateId = drop.assets_to_mint?.[0]?.template_id;
  const { price, currency } = parseListingPrice(drop.listing_price);

  let displayData: { name?: string; description?: string } = {};
  try {
    if (drop.display_data) displayData = JSON.parse(drop.display_data);
  } catch { /* Invalid JSON */ }

  const name = displayData.name || `Drop #${drop.drop_id}`;
  const description = displayData.description || 'A unique NFT drop';
  const maxClaimable = drop.max_claimable || 0;
  const remaining = Math.max(0, maxClaimable - drop.current_claimed);

  return {
    id: `nfthive-${drop.drop_id}`,
    dropId: String(drop.drop_id),
    templateId: templateId ? String(templateId) : undefined,
    collectionName: drop.collection_name,
    name,
    description,
    image: '/placeholder.svg',
    price,
    totalSupply: maxClaimable,
    remaining,
    attributes: [{ trait: 'Rarity', value: 'Common' }],
    endDate: drop.end_time > 0 ? new Date(drop.end_time * 1000).toISOString() : undefined,
    dropSource: 'nfthive',
    settlementSymbol: drop.settlement_symbol,
    listingPrice: drop.listing_price,
    currency,
    authRequired: drop.auth_required === 1,
    isFree: price === 0,
    accountLimit: drop.account_limit || undefined,
  };
}

export async function fetchRawDrops(collection?: string): Promise<NFTDrop[]> {
  try {
    const { fetchTableRows } = await import('@/lib/waxRpcFallback');

    let allDrops: OnChainNFTHiveDrop[] = [];
    let hasMore = true;
    let upperBound: string | undefined = undefined;
    const MAX_ITERATIONS = 10;
    let iterations = 0;

    while (hasMore && iterations < MAX_ITERATIONS) {
      const result = await fetchTableRows<OnChainNFTHiveDrop>({
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'drops',
        limit: 1000,
        reverse: true,
        ...(upperBound ? { upper_bound: upperBound } : {}),
      });

      allDrops.push(...result.rows);
      hasMore = result.more || false;

      if (result.rows.length > 0) {
        const lastDropId = result.rows[result.rows.length - 1].drop_id;
        upperBound = String(lastDropId - 1);
      } else {
        hasMore = false;
      }

      iterations++;
    }

    console.log(`[NFTHive] Fetched ${allDrops.length} total drops from chain in ${iterations} pages`);

    let drops = allDrops;

    if (collection) {
      drops = drops.filter(d => d.collection_name === collection);
    }

    drops = drops.filter(d => !d.is_hidden);
    
    console.log(`[NFTHive] After filtering hidden: ${drops.length} drops`);

    return drops.map(rawDropToNFTDrop);
  } catch (error) {
    console.error('Error fetching raw drops:', error);
    return [];
  }
}

// Enrichment progress callback type
export type EnrichmentProgressCallback = (
  progress: { loaded: number; total: number },
  partialDrops: NFTDrop[]
) => void;

export async function enrichDropTemplates(
  drops: NFTDrop[],
  signal?: AbortSignal,
  onProgress?: EnrichmentProgressCallback
): Promise<NFTDrop[]> {
  const requests: { templateId: string; collectionName: string }[] = [];
  for (const drop of drops) {
    if (drop.templateId && drop.collectionName) {
      requests.push({ templateId: drop.templateId, collectionName: drop.collectionName });
    }
  }

  if (requests.length === 0) {
    onProgress?.({ loaded: 0, total: 0 }, drops);
    return drops;
  }

  onProgress?.({ loaded: 0, total: requests.length }, drops);

  if (signal?.aborted) return drops;

  try {
    const templateCache = await fetchTemplatesBatch(requests);

    const enrichedDrops = drops.map(drop => {
      if (!drop.templateId) return drop;
      const key = `${drop.collectionName}:${drop.templateId}`;
      const cached = templateCache.get(key);
      if (cached) {
        if (cached.image && !cached.image.includes('placeholder')) {
          preloadImage(cached.image);
        }
        return {
          ...drop,
          image: cached.image || drop.image,
          name: cached.name && drop.name.startsWith('Drop #') ? cached.name : drop.name,
          isVideo: cached.isVideo,
        };
      }
      return drop;
    });

    onProgress?.({ loaded: requests.length, total: requests.length }, enrichedDrops);
    return enrichedDrops;
  } catch (error) {
    console.warn('[NFTHive] Batch template fetch failed:', error);
    onProgress?.({ loaded: requests.length, total: requests.length }, drops);
    return drops;
  }
}

// Fetch a single drop by ID (supports nfthive-{dropId} format)
export async function fetchDropById(dropId: string): Promise<NFTDrop | null> {
  try {
    if (dropId.startsWith('nfthive-')) {
      const nfthiveDropId = dropId.replace('nfthive-', '');
      const { fetchTableRows } = await import('@/lib/waxRpcFallback');
      
      const [dropResult, prices] = await Promise.all([
        fetchTableRows<OnChainNFTHiveDrop>({
          code: 'nfthivedrops',
          scope: 'nfthivedrops',
          table: 'drops',
          lower_bound: nfthiveDropId,
          upper_bound: nfthiveDropId,
          limit: 1,
        }),
        fetchDropPrices(nfthiveDropId),
      ]);
      
      if (!dropResult.rows.length) return null;
      
      const onChainDrop = dropResult.rows[0];
      const baseDrop = rawDropToNFTDrop(onChainDrop);
      
      if (prices.length > 0) {
        baseDrop.prices = prices;
      } else {
        const primaryPrice: DropPrice = {
          price: baseDrop.price,
          currency: baseDrop.currency || 'WAX',
          listingPrice: onChainDrop.listing_price,
        };
        baseDrop.prices = [primaryPrice];
      }
      
      if (baseDrop.templateId && baseDrop.collectionName) {
        const templateData = await fetchTemplateById(baseDrop.templateId, baseDrop.collectionName);
        if (templateData) {
          return {
            ...baseDrop,
            image: templateData.image || baseDrop.image,
            name: templateData.name || baseDrop.name,
            isVideo: templateData.isVideo,
          };
        }
      }
      
      return baseDrop;
    }

    // Try fetching as a sale
    return await fetchSaleById(dropId);
  } catch (error) {
    console.error('Error fetching drop by ID:', error);
    return null;
  }
}

export async function fetchSaleById(saleId: string): Promise<NFTDrop | null> {
  try {
    const path = `${ATOMIC_API.paths.sales}/${saleId}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) return null;

    const sale = json.data as AtomicSale;
    const asset = sale.assets[0];
    const data = { ...asset?.immutable_data, ...asset?.data };
    const template = asset?.template;

    return {
      id: sale.sale_id,
      saleId: sale.sale_id,
      templateId: template?.template_id,
      collectionName: sale.collection_name,
      name: data.name || asset?.name || `NFT #${sale.sale_id}`,
      description: data.description || 'A unique NFT from the Cheese collection',
      image: getImageUrl(data.img || data.image),
      price: parseFloat(sale.listing_price) / Math.pow(10, sale.price.token_precision),
      totalSupply: template ? parseInt(template.max_supply) || 1 : 1,
      remaining: template ? Math.max(0, parseInt(template.max_supply) - parseInt(template.issued_supply)) : 1,
      seller: sale.seller,
      attributes: [
        { trait: 'Rarity', value: extractRarity(data) },
        ...buildAttributes(data).slice(0, 5),
      ],
      dropSource: 'sale',
    };
  } catch (error) {
    console.error('Error fetching sale:', error);
    return null;
  }
}

// =============================================================================
// User collections and templates
// =============================================================================

export async function fetchUserCollections(account: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      authorized_account: account,
      limit: '100',
    });
    const path = `${ATOMIC_API.paths.collections}?${params.toString()}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();
    if (!json.success || !json.data) return [];
    return json.data.map((c: { collection_name: string }) => c.collection_name);
  } catch (error) {
    console.error('Error fetching user collections:', error);
    return [];
  }
}

export async function fetchTemplateById(
  templateId: string,
  collectionName?: string
): Promise<{ name: string; image: string; maxSupply: number; issuedSupply: number; isVideo?: boolean } | null> {
  try {
    const path = collectionName 
      ? `${ATOMIC_API.paths.templates}/${collectionName}/${templateId}`
      : `${ATOMIC_API.paths.templates}/${templateId}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();
    if (!json.success || !json.data) return null;

    const template = json.data;
    const data = template.immutable_data || {};
    const media = getMediaUrl(data);

    return {
      name: data.name || template.name || `Template #${templateId}`,
      image: media.url,
      isVideo: media.isVideo,
      maxSupply: parseInt(template.max_supply) || 0,
      issuedSupply: parseInt(template.issued_supply) || 0,
    };
  } catch (error) {
    console.error('Error fetching template:', error);
    return null;
  }
}

// Fetch user's owned NFTs
export async function fetchUserAssets(
  account: string,
  collectionName?: string
): Promise<Array<{
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  template_id: string;
  mint: string;
}>> {
  try {
    const params = new URLSearchParams({
      owner: account,
      limit: '100',
      order: 'desc',
      sort: 'asset_id',
    });
    if (collectionName) params.set('collection_name', collectionName);
    const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();
    if (!json.success || !json.data) return [];

    return json.data.map((asset: {
      asset_id: string;
      name?: string;
      data?: { name?: string; img?: string; image?: string };
      collection?: { collection_name?: string };
      template?: { template_id?: string };
      template_mint?: string;
    }) => ({
      asset_id: asset.asset_id,
      name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
      image: getImageUrl(asset.data?.img || asset.data?.image),
      collection: asset.collection?.collection_name || '',
      template_id: asset.template?.template_id || '',
      mint: asset.template_mint || '',
    }));
  } catch (error) {
    console.error('Error fetching user assets:', error);
    return [];
  }
}

// Fetch drops created by a specific user
export async function fetchUserDrops(account: string): Promise<Array<{
  dropId: number;
  name: string;
  image: string;
  price: number;
  currency: string;
  maxClaimable: number;
  numClaimed: number;
  startTime: number;
  endTime: number;
  collectionName: string;
}>> {
  try {
    const userCollections = await fetchUserCollections(account);
    if (userCollections.length === 0) return [];
    
    const getData = (immutableData: Array<{ key: string; value: [string, string] }>, key: string): string => {
      const item = immutableData.find(d => d.key === key);
      return item?.value?.[1] || '';
    };
    
    const allUserDrops: Array<{
      dropId: number;
      name: string;
      image: string;
      price: number;
      currency: string;
      maxClaimable: number;
      numClaimed: number;
      startTime: number;
      endTime: number;
      collectionName: string;
    }> = [];
    
    for (const collectionName of userCollections) {
      try {
        const url = `${NFTHIVE_CONFIG.apiUrl}/api/drops?collection=${collectionName}`;
        const response = await fetch(url);
        const drops = await response.json() as NFTHiveDrop[];
        
        for (const drop of drops) {
          const template = drop.templatesToMint?.[0];
          const immutableData = template?.immutableData || [];
          const name = drop.displayData?.name || getData(immutableData, 'name') || template?.name || `Drop #${drop.dropId}`;
          const img = getData(immutableData, 'img') || getData(immutableData, 'image');
          
          allUserDrops.push({
            dropId: drop.dropId,
            name,
            image: getImageUrl(img),
            price: drop.price,
            currency: drop.currency || 'WAX',
            maxClaimable: drop.maxClaimable || 0,
            numClaimed: drop.numClaimed || 0,
            startTime: drop.startTime || 0,
            endTime: drop.endTime || 0,
            collectionName: drop.collection?.collectionName || collectionName,
          });
        }
      } catch (error) {
        console.error(`Error fetching drops for collection ${collectionName}:`, error);
      }
    }
    
    return allUserDrops;
  } catch (error) {
    console.error('Error fetching user drops:', error);
    return [];
  }
}

// Fetch CHEESE drop stats
export async function fetchCheeseDropStats(): Promise<{ activeDrops: number; totalSold: number }> {
  try {
    const dropsResponse = await fetch('https://wax.eosusa.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'drops',
        limit: 1000,
      }),
    });

    const dropsData = await dropsResponse.json();
    const allDrops = dropsData.rows || [];

    const pricesResponse = await fetch('https://wax.eosusa.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'dropprices',
        limit: 1000,
      }),
    });

    const pricesData = await pricesResponse.json();
    const allPrices = pricesData.rows || [];

    const cheeseDropIds = new Set<number>();
    
    for (const price of allPrices) {
      const tokenSymbol = price.token_symbol || '';
      const tokenContract = price.token_contract || '';
      if (tokenSymbol.includes('CHEESE') || tokenContract === 'cheeseburger') {
        cheeseDropIds.add(price.drop_id);
      }
    }

    for (const drop of allDrops) {
      if (drop.collection_name === CHEESE_CONFIG.collectionName) {
        cheeseDropIds.add(drop.drop_id);
      }
    }

    const now = Math.floor(Date.now() / 1000);
    let activeDrops = 0;
    let totalSold = 0;

    for (const drop of allDrops) {
      if (!cheeseDropIds.has(drop.drop_id)) continue;
      const claimed = drop.current_claimed || 0;
      totalSold += claimed;
      const startTime = drop.start_time || 0;
      const endTime = drop.end_time || 0;
      const isStarted = startTime === 0 || startTime <= now;
      const isNotEnded = endTime === 0 || endTime > now;
      if (isStarted && isNotEnded) activeDrops++;
    }

    return { activeDrops, totalSold };
  } catch (error) {
    console.error('Error fetching CHEESE drop stats:', error);
    return { activeDrops: 0, totalSold: 0 };
  }
}

// =============================================================================
// NFT fetching by schema (for DAO voting)
// =============================================================================

export interface EligibleNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
}

export async function fetchUserNFTsBySchema(
  userAccount: string,
  collections: string[],
  schemas: string[]
): Promise<EligibleNFT[]> {
  const eligibleNFTs: EligibleNFT[] = [];

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];
    const schema = schemas[i];
    if (!collection || !schema) continue;

    let fetched = false;
    const endpoints = [
      'https://aa.wax.blacklusion.io',
      'https://wax-aa.eu.eosamsterdam.net',
      'https://wax.api.atomicassets.io',
    ];
    for (const baseUrl of endpoints) {
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
      } catch {
        continue;
      }
    }
  }

  return eligibleNFTs;
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

export { getIpfsUrl };
