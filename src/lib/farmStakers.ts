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
 * Fetch every staker row for a single farm.
 *
 * On farms.waxdao V2 the `stakers` table is scoped by the **contract**, not
 * by farm name (each row carries a `farmname` field). The `stakednfts` table
 * is scoped by farm name with one row per staked asset.
 *
 * Strategy:
 *   1. Paginate `stakednfts` (scope = farmName) and group by owner. Cheap & correct.
 *   2. Fallback: paginate the global `stakers` table (scope = FARM_CONTRACT)
 *      and keep rows matching this farm.
 */
export async function fetchFarmStakers(farmName: string): Promise<FarmStakerRow[]> {
  const byUser = new Map<string, Set<string>>();
  const addAsset = (user: string, assetId: string) => {
    const u = user.trim();
    const id = String(assetId).trim();
    if (!u || !id) return;
    let set = byUser.get(u);
    if (!set) {
      set = new Set();
      byUser.set(u, set);
    }
    set.add(id);
  };

  const MAX_ITERATIONS = 20;
  const PAGE_SIZE = 1000;

  // Strategy 1: stakednfts scoped by farmName, one row per asset.
  try {
    let lowerBound: string | undefined = undefined;
    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
      const res = await fetchTableRows<Record<string, unknown>>({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "stakednfts",
        limit: PAGE_SIZE,
        ...(lowerBound ? { lower_bound: lowerBound } : {}),
      });
      const rows = res.rows || [];
      for (const row of rows) {
        const owner = String(row.owner || row.staker || row.user || row.wallet || "").trim();
        const assetId = row.asset_id ?? row.assetid ?? row.id;
        if (!owner || assetId == null) continue;
        addAsset(owner, String(assetId));
      }
      if (!res.more || rows.length === 0) break;
      const last = rows[rows.length - 1] as Record<string, unknown>;
      const lastKey = last.asset_id ?? last.assetid ?? last.id;
      if (lastKey == null) break;
      // Advance past the last asset_id (numeric primary key).
      const next = BigInt(String(lastKey)) + 1n;
      lowerBound = next.toString();
      iterations++;
    }
  } catch (e) {
    console.warn("[fetchFarmStakers] stakednfts strategy failed:", e);
  }

  // Strategy 2: fall back to global stakers table if stakednfts yielded nothing.
  if (byUser.size === 0) {
    try {
      let upperBound: string | undefined = undefined;
      let iterations = 0;
      while (iterations < MAX_ITERATIONS) {
        const res = await fetchTableRows<Record<string, unknown>>({
          code: FARM_CONTRACT,
          scope: FARM_CONTRACT,
          table: "stakers",
          limit: PAGE_SIZE,
          reverse: true,
          ...(upperBound ? { upper_bound: upperBound } : {}),
        });
        const rows = res.rows || [];
        for (const row of rows) {
          const rowFarm = (row.farmname || row.farm_name || "") as string;
          if (rowFarm !== farmName) continue;
          const user = String(row.user || row.staker || row.owner || "").trim();
          const rawIds = (row.asset_ids || row.staked_assets || row.assets || []) as Array<string | number>;
          if (!user || !Array.isArray(rawIds)) continue;
          for (const id of rawIds) addAsset(user, String(id));
        }
        if (!res.more || rows.length === 0) break;
        const last = rows[rows.length - 1] as Record<string, unknown>;
        const lastId = Number(last.ID ?? last.id);
        if (!Number.isFinite(lastId)) break;
        upperBound = String(lastId - 1);
        iterations++;
      }
    } catch (e) {
      console.warn("[fetchFarmStakers] global stakers fallback failed:", e);
    }
  }

  const out: FarmStakerRow[] = Array.from(byUser.entries()).map(([user, set]) => ({
    user,
    assetIds: Array.from(set),
  }));
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