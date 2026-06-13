// Owner-only template-distribution helpers for a farm.
//
// For each template a farm accepts, we resolve:
//   1) issued/max supply + name + image (from AtomicAssets templates endpoint)
//   2) number of assets of that template currently held by the farm contract
//      (which equals the number staked in this farm, because farms.waxdao
//      escrows the NFTs while staked).
//
// Both lookups go through the existing multi-endpoint fetchWithFallback so
// 429s / dead endpoints are handled the same way as the rest of the app.

import { fetchWithFallback } from "./fetchWithFallback";
import { ATOMIC_API } from "./waxConfig";
import { FARM_CONTRACT } from "./farm";

export const TEMPLATE_DISTRIBUTION_MAX = 50;
export const TEMPLATE_FETCH_CONCURRENCY = 5;

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function toImageUrl(img: string | undefined): string {
  if (!img) return "/placeholder.svg";
  if (img.startsWith("http")) return img;
  if (img.startsWith("ipfs://")) return `${IPFS_GATEWAY}${img.replace("ipfs://", "")}`;
  if (img.startsWith("Qm") || img.startsWith("bafy") || img.startsWith("bafk")) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img;
}

export interface TemplateStats {
  templateId: number;
  collection: string;
  name: string;
  image: string;
  issuedSupply: number;
  maxSupply: number; // 0 = uncapped
}

export async function fetchTemplateStats(
  collection: string,
  templateId: number,
): Promise<TemplateStats> {
  const path = `/atomicassets/v1/templates/${encodeURIComponent(collection)}/${encodeURIComponent(String(templateId))}`;
  const res = await fetchWithFallback(ATOMIC_API.baseUrls, path);
  const json = await res.json();
  if (!json?.success || !json.data) {
    throw new Error(`Template ${collection}/${templateId} not found`);
  }
  const data = json.data;
  const immutable = (data.immutable_data || {}) as Record<string, string | undefined>;
  return {
    templateId,
    collection,
    name: immutable.name || data.name || `Template #${templateId}`,
    image: toImageUrl(immutable.img || immutable.image),
    issuedSupply: Number(data.issued_supply ?? 0),
    maxSupply: Number(data.max_supply ?? 0),
  };
}

/**
 * Number of assets of this template currently held by the farm contract.
 * Uses the AtomicAssets count flag so we never download asset bodies.
 */
export async function fetchTemplateStakedCount(
  collection: string,
  templateId: number,
): Promise<number> {
  const params = new URLSearchParams({
    collection_name: collection,
    template_id: String(templateId),
    owner: FARM_CONTRACT,
    page: "1",
    limit: "1",
    count: "true",
  });
  const path = `/atomicassets/v1/assets?${params.toString()}`;
  const res = await fetchWithFallback(ATOMIC_API.baseUrls, path);
  const json = await res.json();
  if (!json?.success) {
    throw new Error(`Asset count for ${collection}/${templateId} failed`);
  }
  // With count=true the API returns the total in `data` as a string/number.
  const n = Number(json.data);
  return Number.isFinite(n) ? n : 0;
}

/** Run an async mapper with a hard concurrency cap. Preserves input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}