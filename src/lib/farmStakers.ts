// Fetch the list of stakers for a single farm + per-asset thumbnails.
// Uses the farms.waxdao `stakers` table (scoped by farm name) and the
// AtomicAssets API for asset metadata.

import { fetchTableRows } from "./waxRpcFallback";
import { fetchWithFallback } from "./fetchWithFallback";
import { ATOMIC_API } from "./waxConfig";
import { FARM_CONTRACT } from "./farm";

export interface FarmStakerRow {
  user: string;
  assetIds: string[];
}

export interface StakerAssetMeta {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  template_id: string;
  mint: string;
}

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

function pickImage(data: Record<string, string | undefined> | undefined): string {
  if (!data) return "/placeholder.svg";
  const img = data.img || data.image || data.video;
  return toImageUrl(img);
}

/**
 * Fetch every staker row for a single farm. The `stakers` table is scoped
 * by farm name on the V2 farms.waxdao contract, so a scoped query returns
 * only that farm's stakers without any client-side filtering.
 */
export async function fetchFarmStakers(farmName: string): Promise<FarmStakerRow[]> {
  const out: FarmStakerRow[] = [];
  let lowerBound: string | undefined = undefined;
  let iterations = 0;
  const MAX_ITERATIONS = 20;
  const PAGE_SIZE = 1000;

  while (iterations < MAX_ITERATIONS) {
    const res = await fetchTableRows<Record<string, unknown>>({
      code: FARM_CONTRACT,
      scope: farmName,
      table: "stakers",
      limit: PAGE_SIZE,
      ...(lowerBound ? { lower_bound: lowerBound } : {}),
    });

    const rows = res.rows || [];
    for (const row of rows) {
      const user = String(row.user || row.staker || row.owner || "").trim();
      const rawIds = (row.asset_ids || row.staked_assets || row.assets || []) as Array<string | number>;
      const assetIds = Array.isArray(rawIds) ? rawIds.map(id => String(id)).filter(Boolean) : [];
      if (!user || assetIds.length === 0) continue;

      // Same wallet can theoretically appear multiple times; merge.
      const existing = out.find(r => r.user === user);
      if (existing) {
        for (const id of assetIds) {
          if (!existing.assetIds.includes(id)) existing.assetIds.push(id);
        }
      } else {
        out.push({ user, assetIds });
      }
    }

    if (!res.more || rows.length === 0) break;
    const last = rows[rows.length - 1] as Record<string, unknown>;
    const lastKey = last.user ?? last.staker ?? last.owner ?? last.ID ?? last.id;
    if (lastKey == null) break;
    // PostgREST-style: advance just past the last key. For `name` PKs the
    // RPC will accept the same name and return overlapping rows; dedupe above.
    lowerBound = String(lastKey);
    iterations++;
  }

  // Sort by staked count desc
  out.sort((a, b) => b.assetIds.length - a.assetIds.length);
  return out;
}

/**
 * Fetch metadata + image for a batch of asset IDs from AtomicAssets.
 * Mirrors the batching pattern used in useUserNFTs.
 */
export async function fetchAssetsMetadata(assetIds: string[]): Promise<Map<string, StakerAssetMeta>> {
  const out = new Map<string, StakerAssetMeta>();
  if (assetIds.length === 0) return out;

  const unique = Array.from(new Set(assetIds));
  const batchSize = 50;
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += batchSize) {
    batches.push(unique.slice(i, i + batchSize));
  }

  const parallelLimit = 3;
  for (let i = 0; i < batches.length; i += parallelLimit) {
    const group = batches.slice(i, i + parallelLimit);
    await Promise.all(
      group.map(async (batch) => {
        try {
          const path = `${ATOMIC_API.paths.assets}?ids=${batch.join(",")}&limit=${batch.length}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
          const json = await response.json();
          if (!json?.success || !Array.isArray(json.data)) return;

          for (const asset of json.data) {
            const data = { ...(asset.immutable_data || {}), ...(asset.data || {}) } as Record<string, string | undefined>;
            out.set(String(asset.asset_id), {
              asset_id: String(asset.asset_id),
              name: data.name || asset.name || `NFT #${asset.asset_id}`,
              image: pickImage(data),
              collection: asset.collection?.collection_name || "",
              template_id: asset.template?.template_id || "",
              mint: asset.template_mint || "",
            });
          }
        } catch (err) {
          console.warn("[fetchAssetsMetadata] batch failed:", err);
        }
      })
    );
  }

  return out;
}