## Problem

Two correctness bugs in the template distribution panel:

1. **Staked counts are 0.** We assumed the farm contract holds the NFTs (`/accounts/farms.waxdao/{collection}` → per-template `assets`). It doesn't — `farms.waxdao` reports `{"templates":[]}` for `cheesenftwax`. Staked NFTs live in the contract's `stakednfts` table, not the asset escrow.
2. **Issued supply ignores burns.** Template 894299 shows 18 issued, but 10 have been nulled → only 8 in circulation. The AtomicAssets `templates/{c}/{t}` endpoint returns `issued_supply=18` and no `burned_supply`. We need the dedicated stats endpoint.

## Fix

### A. Derive staked counts from `stakednfts` (exact, no guessing)

Reuse the same data path the Stakers table already loads:

- Call `fetchFarmStakers(farmName)` → flattens to a deduped `assetIds[]`.
- Call `fetchAssetsMetadata(assetIds)` (bulk, in chunks; already used by `useStakerAssetMeta`) → each `StakerAssetMeta` carries `collection` + `template_id`.
- Group locally: `Map<"{collection}:{template_id}", number>`.

This gives the exact count of NFTs staked in this farm per template, with zero new endpoints and no farm-escrow assumption. Concurrency is bounded by the existing bulk-metadata fetcher.

### B. Use the templates `stats` endpoint for circulating supply

Verified shape:

```
GET /atomicassets/v1/templates/{collection}/{template_id}/stats
→ { success: true, data: { assets: "18", burned: "10" } }
```

In `fetchTemplateStats`, do **two** calls per template (still cached, still concurrency-capped):

- `/templates/{c}/{t}` → `name`, `image`, `issuedSupply`, `maxSupply` (unchanged)
- `/templates/{c}/{t}/stats` → `burnedSupply`

Compute `circulatingSupply = max(0, issuedSupply - burnedSupply)`.

### C. UI: show both denominators

Per the earlier "show both" choice, render two lines per row:

- `staked / circulating (pct%)` — primary, cheese-colored
- `staked / issued · N burned · max` (or `uncapped`)

`countUnknown` semantics stay the same: if stakers fail to load, show `—` for staked + percentages; supply still renders.

### D. Remove dead code

Drop `fetchFarmTemplateCounts` and the `FARM_CONTRACT`/accounts code path from `src/lib/farmTemplateStats.ts` — no longer used.

## Files to change

- `src/lib/farmTemplateStats.ts` — remove `fetchFarmTemplateCounts`; extend `fetchTemplateStats` to also fetch `/stats` and return `burnedSupply` + `circulatingSupply`; add a `fetchFarmStakedCountsByTemplate(farmName)` helper that calls `fetchFarmStakers` + `fetchAssetsMetadata` and returns the `Map`.
- `src/hooks/useFarmTemplateDistribution.ts` — swap the counts source; recompute `issuedPct` against circulating supply (and keep a separate `maxPct` against `maxSupply`); extend `TemplateDistributionRow` with `circulatingSupply` and `burnedSupply`.
- `src/components/farm/FarmTemplateDistribution.tsx` — render the new two-line breakdown.

## Verification

On `/farm/cheesefarm`, template #894299 (`$CHEESE Mug 1`) should show:

```
7 / 8 circulating (87.5%)
7 / 18 issued · 10 nulled · uncapped max
```

Network panel:

- 1× `stakednfts` pagination (existing)
- 1× bulk `assets?ids=...` per ~100 staked assets (existing path)
- 2× `templates/...` calls per template (detail + stats), both 200s
- Zero `count=true` requests, zero `/accounts/farms.waxdao/...` requests.
