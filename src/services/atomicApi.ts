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

// Known alternate image fields used by various WAX NFT collections
const KNOWN_IMAGE_FIELDS = ['backimg', 'frontimg', 'glbimg', 'pfp', 'logo', 'icon'];

function looksLikeImageValue(val: string): boolean {
  if (/^Qm[a-zA-Z0-9]{44}/.test(val) || /^bafy[a-zA-Z0-9]+/.test(val) || /^bafk[a-zA-Z0-9]+/.test(val)) return true;
  if (val.startsWith('ipfs://')) return true;
  if (/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg|mp4|webm)/i.test(val)) return true;
  if (/\/ipfs\/[a-zA-Z0-9]/.test(val)) return true;
  return false;
}

function getMediaUrl(data: Record<string, string>): { url: string; isVideo: boolean } {
  const imageField = data.img || data.image;
  if (imageField) return { url: getImageUrl(imageField), isVideo: false };
  const videoField = data.video;
  if (videoField) return { url: getImageUrl(videoField), isVideo: true };

  for (const field of KNOWN_IMAGE_FIELDS) {
    const val = data[field];
    if (val) return { url: getImageUrl(val), isVideo: false };
  }

  for (const [key, val] of Object.entries(data)) {
    if (!val || typeof val !== 'string') continue;
    if (['name', 'description', 'img', 'image', 'video', ...KNOWN_IMAGE_FIELDS].includes(key)) continue;
    if (looksLikeImageValue(val)) {
      return { url: getImageUrl(val), isVideo: false };
    }
  }

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
): Promise<Map<string, { name: string; image: string; isVideo?: boolean; schemaName?: string }>> {
  const uniqueRequests = new Map<string, { templateId: string; collectionName: string }>();
  for (const req of requests) {
    if (!uniqueRequests.has(req.templateId)) {
      uniqueRequests.set(req.templateId, req);
    }
  }

  const results = new Map<string, { name: string; image: string; isVideo?: boolean; schemaName?: string }>();
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
            schemaName: template.schema?.schema_name || undefined,
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

// Fetch ALL drop prices in bulk (paginated)
export async function fetchAllDropPrices(): Promise<Map<number, DropPrice[]>> {
  const priceMap = new Map<number, DropPrice[]>();
  try {
    const { fetchTableRows } = await import('@/lib/waxRpcFallback');
    let hasMore = true;
    let lowerBound: string | undefined = undefined;
    const MAX_ITERATIONS = 20;
    let iterations = 0;

    while (hasMore && iterations < MAX_ITERATIONS) {
      const result = await fetchTableRows<OnChainDropPrice>({
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'dropprices',
        limit: 1000,
        ...(lowerBound ? { lower_bound: lowerBound } : {}),
      });

      for (const row of result.rows) {
        const prices = row.listing_prices.map((priceStr): DropPrice => {
          const { price, currency } = parseListingPrice(priceStr);
          return { price, currency, listingPrice: priceStr };
        });
        priceMap.set(row.drop_id, prices);
      }

      hasMore = result.more || false;
      if (result.rows.length > 0) {
        lowerBound = String(result.rows[result.rows.length - 1].drop_id + 1);
      } else {
        hasMore = false;
      }
      iterations++;
    }

    console.log(`[NFTHive] Fetched prices for ${priceMap.size} drops`);
  } catch (error) {
    console.warn('[NFTHive] Failed to fetch bulk drop prices:', error);
  }
  return priceMap;
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
    startDate: drop.start_time > 0 ? new Date(drop.start_time * 1000).toISOString() : undefined,
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

    // Fetch all drop prices in parallel
    const allPrices = await fetchAllDropPrices();

    return drops.map(d => {
      const nftDrop = rawDropToNFTDrop(d);
      const prices = allPrices.get(d.drop_id);
      if (prices && prices.length > 0) {
        nftDrop.prices = prices;
      } else {
        // Fall back to the primary listing price
        nftDrop.prices = [{
          price: nftDrop.price,
          currency: nftDrop.currency || 'WAX',
          listingPrice: nftDrop.listingPrice || `${nftDrop.price} ${nftDrop.currency || 'WAX'}`,
        }];
      }
      return nftDrop;
    });
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
          schemaName: cached.schemaName || drop.schemaName,
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
      
      if (baseDrop.templateId && baseDrop.collectionName && baseDrop.templateId !== '-1') {
        const templateData = await fetchTemplateById(baseDrop.templateId, baseDrop.collectionName);
        if (templateData) {
          return {
            ...baseDrop,
            image: templateData.image || baseDrop.image,
            name: templateData.name || baseDrop.name,
          };
        }
      }

      // Premint fallback: resolve image from deposited assets via AtomicAssets API
      const isPremint = !onChainDrop.assets_to_mint || onChainDrop.assets_to_mint.length === 0 ||
        (onChainDrop.assets_to_mint[0]?.template_id === -1);
      
      if (isPremint) {
        (baseDrop as any).isPremint = true;
      }

      if (isPremint && (!baseDrop.image || baseDrop.image === '/placeholder.svg')) {
        try {
          const assetsPath = `${ATOMIC_API.paths.assets}?owner=nfthivedrops&collection_name=${baseDrop.collectionName}&limit=1`;
          const resp = await fetchWithFallback(ATOMIC_API.baseUrls, assetsPath);
          const json = await resp.json();
          if (json.success && json.data && json.data.length > 0) {
            const asset = json.data[0];
            const data = asset.data || {};
            const immutableData = asset.immutable_data || {};
            const resolvedImg = data.img || data.image || immutableData.img || immutableData.image;
            if (resolvedImg) {
              baseDrop.image = getImageUrl(resolvedImg);
            }
          }
        } catch (err) {
          console.warn('[NFTHive] Failed to resolve premint image for drop', nfthiveDropId, err);
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
): Promise<{ name: string; image: string; maxSupply: number; issuedSupply: number; isVideo?: boolean; schemaName?: string } | null> {
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
      schemaName: template.schema?.schema_name || undefined,
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

// Fetch drops created by a specific user (combines NFTHive API + on-chain data for premint support)
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
  isPremint?: boolean;
}>> {
  type UserDrop = {
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
    isPremint?: boolean;
  };

  try {
    const userCollections = await fetchUserCollections(account);
    if (userCollections.length === 0) return [];
    
    const getData = (immutableData: Array<{ key: string; value: [string, string] }>, key: string): string => {
      const item = immutableData.find(d => d.key === key);
      return item?.value?.[1] || '';
    };
    
    // 1) Fetch from NFTHive API (good for mint-on-demand with template data)
    const apiDropsMap = new Map<number, UserDrop>();
    
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
          
          apiDropsMap.set(drop.dropId, {
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
    
    // 2) Fetch from chain to catch premint drops the API may miss
    const { fetchTableRows } = await import('@/lib/waxRpcFallback');
    
    for (const collectionName of userCollections) {
      try {
        // Scan all drops and filter by authorized_account + collection
        // We fetch in reverse (newest first) and stop early after gaps
        let hasMore = true;
        let upperBound: string | undefined = undefined;
        let iterations = 0;
        
        while (hasMore && iterations < 10) {
          const result = await fetchTableRows<OnChainNFTHiveDrop>({
            code: 'nfthivedrops',
            scope: 'nfthivedrops',
            table: 'drops',
            limit: 500,
            reverse: true,
            ...(upperBound ? { upper_bound: upperBound } : {}),
          });
          
          for (const drop of result.rows) {
            if (drop.authorized_account !== account) continue;
            if (drop.collection_name !== collectionName) continue;

            const existingDrop = apiDropsMap.get(drop.drop_id);
            const { price, currency } = parseListingPrice(drop.listing_price);
            let displayData: { name?: string; description?: string } = {};
            try {
              if (drop.display_data) displayData = JSON.parse(drop.display_data);
            } catch { /* ignore */ }

            const isPremint = !drop.assets_to_mint || drop.assets_to_mint.length === 0 || 
              (drop.assets_to_mint[0]?.template_id === -1);

            let image = existingDrop?.image || '/placeholder.svg';
            const needsImageFallback = !existingDrop || !existingDrop.image || existingDrop.image === '/placeholder.svg';

            // For mint-on-demand, try to fetch template image if the API didn't provide one
            if (!isPremint && needsImageFallback && drop.assets_to_mint?.[0]?.template_id > 0) {
              try {
                const templateData = await fetchTemplateById(
                  String(drop.assets_to_mint[0].template_id), 
                  collectionName
                );
                if (templateData?.image) image = templateData.image;
              } catch { /* ignore */ }
            }

            // For premint drops, fetch image from deposited assets via AtomicAssets API
            if (isPremint && needsImageFallback) {
              try {
                const assetsPath = `${ATOMIC_API.paths.assets}?owner=nfthivedrops&collection_name=${collectionName}&limit=1`;
                const resp = await fetchWithFallback(ATOMIC_API.baseUrls, assetsPath);
                const json = await resp.json();
                if (json.success && json.data && json.data.length > 0) {
                  const asset = json.data[0];
                  const data = asset.data || {};
                  const immutableData = asset.immutable_data || {};
                  const resolvedImg = data.img || data.image || immutableData.img || immutableData.image;
                  if (resolvedImg) {
                    image = getImageUrl(resolvedImg);
                  }
                }
              } catch (err) {
                console.warn(`[NFTHive] Failed to resolve premint image for drop ${drop.drop_id}:`, err);
              }
            }

            apiDropsMap.set(drop.drop_id, {
              dropId: drop.drop_id,
              name: existingDrop?.name || displayData.name || `Drop #${drop.drop_id}`,
              image,
              price: existingDrop?.price ?? price,
              currency: existingDrop?.currency || currency || 'WAX',
              maxClaimable: existingDrop?.maxClaimable ?? drop.max_claimable ?? 0,
              numClaimed: existingDrop?.numClaimed ?? drop.current_claimed ?? 0,
              startTime: existingDrop?.startTime ?? drop.start_time ?? 0,
              endTime: existingDrop?.endTime ?? drop.end_time ?? 0,
              collectionName: existingDrop?.collectionName || drop.collection_name,
              isPremint,
            });
          }
          
          hasMore = result.more || false;
          if (result.rows.length > 0) {
            upperBound = String(result.rows[result.rows.length - 1].drop_id - 1);
          } else {
            hasMore = false;
          }
          iterations++;
        }
      } catch (error) {
        console.error(`Error fetching on-chain drops for ${collectionName}:`, error);
      }
    }
    
    return Array.from(apiDropsMap.values());
  } catch (error) {
    console.error('Error fetching user drops:', error);
    return [];
  }
}

// Fetch CHEESE drop stats
const HYPERION_ENDPOINTS_DROPS = [
  'https://wax.eosusa.io/v2/history/get_actions',
  'https://wax.eosphere.io/v2/history/get_actions',
];
const DROPS_BATCH_SIZE = 1000;
const DROPS_MAX_ACTIONS = 10000;
const DROPS_START_DATE = '2026-03-24T00:00:00.000Z';

function parseCheeseAmount(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

async function fetchCheeseTransfersHyperion(
  params: { from?: string; to?: string },
): Promise<number> {
  for (const endpoint of HYPERION_ENDPOINTS_DROPS) {
    try {
      let total = 0;
      let skip = 0;

      while (skip < DROPS_MAX_ACTIONS) {
        let url = `${endpoint}?act.account=cheeseburger&act.name=transfer&after=${DROPS_START_DATE}&limit=${DROPS_BATCH_SIZE}&skip=${skip}`;
        if (params.from) url += `&transfer.from=${params.from}`;
        if (params.to) url += `&transfer.to=${params.to}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Hyperion error: ${response.status}`);

        const data = await response.json();
        const actions = data.actions;
        if (!actions || actions.length === 0) break;

        for (const action of actions) {
          const d = action.act?.data;
          if (d?.quantity) {
            total += parseCheeseAmount(d.quantity);
          }
        }

        if (actions.length < DROPS_BATCH_SIZE) break;
        skip += DROPS_BATCH_SIZE;
      }

      return total;
    } catch (err) {
      console.error(`CHEESE transfer fetch failed for ${endpoint} (${params.from ?? '*'}->${params.to ?? '*'}):`, err);
      continue;
    }
  }
  return 0;
}

export interface CheeseDropStats {
  activeDrops: number;
  totalSold: number;
  cheeseNulled: number;
  xCheeseValue: number;
}

export async function fetchCheeseDropStats(): Promise<CheeseDropStats> {
  try {
    const [dropsResponse, totalSold, cheeseNulled, xCheeseValue] = await Promise.all([
      fetch('https://wax.eosusa.io/v1/chain/get_table_rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: true,
          code: 'nfthivedrops',
          scope: 'nfthivedrops',
          table: 'drops',
          limit: 1000,
        }),
      }),
      fetchCheeseTransfersHyperion({ from: 'nfthivedrops' }),
      fetchCheeseTransfersHyperion({ from: 'cheesenftwax', to: 'eosio.null' }),
      fetchCheeseTransfersHyperion({ from: 'cheesenftwax', to: 'xcheeseliqst' }),
    ]);

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

    for (const drop of allDrops) {
      if (!cheeseDropIds.has(drop.drop_id)) continue;
      const startTime = drop.start_time || 0;
      const endTime = drop.end_time || 0;
      const isStarted = startTime === 0 || startTime <= now;
      const isNotEnded = endTime === 0 || endTime > now;
      if (isStarted && isNotEnded) activeDrops++;
    }

    return {
      activeDrops,
      totalSold: Math.floor(totalSold),
      cheeseNulled: Math.floor(cheeseNulled),
      xCheeseValue: Math.floor(xCheeseValue),
    };
  } catch (error) {
    console.error('Error fetching CHEESE drop stats:', error);
    return { activeDrops: 0, totalSold: 0, cheeseNulled: 0, xCheeseValue: 0 };
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
