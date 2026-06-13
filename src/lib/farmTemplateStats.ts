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
import { fetchFarmStakers, fetchAssetsMetadata } from "./farmStakers";

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
  burnedSupply: number;
  circulatingSupply: number; // max(0, issued - burned)
}

export async function fetchTemplateStats(
  collection: string,
  templateId: number,
): Promise<TemplateStats> {
  const path = `/atomicassets/v1/templates/${encodeURIComponent(collection)}/${encodeURIComponent(String(templateId))}`;
  const statsPath = `${path}/stats`;
  const [detailRes, statsRes] = await Promise.all([
    fetchWithFallback(ATOMIC_API.baseUrls, path),
    fetchWithFallback(ATOMIC_API.baseUrls, statsPath).catch(() => null),
  ]);
  const json = await detailRes.json();
  if (!json?.success || !json.data) {
    throw new Error(`Template ${collection}/${templateId} not found`);
  }
  const data = json.data;
  const immutable = (data.immutable_data || {}) as Record<string, string | undefined>;
  const issuedSupply = Number(data.issued_supply ?? 0);
  const maxSupply = Number(data.max_supply ?? 0);

  let burnedSupply = 0;
  if (statsRes) {
    try {
      const sj = await statsRes.json();
      if (sj?.success && sj.data) {
        const b = Number(sj.data.burned ?? 0);
        if (Number.isFinite(b)) burnedSupply = b;
      }
    } catch {
      // ignore — burned stays 0
    }
  }

  return {
    templateId,
    collection,
    name: immutable.name || data.name || `Template #${templateId}`,
    image: toImageUrl(immutable.img || immutable.image),
    issuedSupply,
    maxSupply,
    burnedSupply,
    circulatingSupply: Math.max(0, issuedSupply - burnedSupply),
  };
}

/**
 * Exact per-template staked counts for a farm. Pulls the farm's
 * `stakednfts` rows (asset ids actually staked) and resolves each id to
 * its `{collection, template_id}` via the AtomicAssets bulk assets
 * endpoint, then counts locally. Returns a map keyed by
 * `"{collection}:{template_id}"` → count.
 */
export async function fetchFarmStakedCountsByTemplate(
  farmName: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const stakers = await fetchFarmStakers(farmName);
  const allIds = stakers.flatMap((s) => s.assetIds);
  if (allIds.length === 0) return out;
  const meta = await fetchAssetsMetadata(allIds);
  for (const id of allIds) {
    const m = meta.get(id);
    if (!m || !m.collection || !m.template_id) continue;
    const key = `${m.collection}:${m.template_id}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
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