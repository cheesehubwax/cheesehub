## Per-Template Staked % (Owner-Only, Manual Compute, ≤ 50 Templates)

Add a collapsible "Template Distribution" panel above `FarmStakersTable` on the farm detail page, **visible only to the farm creator**. Manual-trigger only.

### Visibility gate

`FarmDetail.tsx` already computes `const isCreator = accountName === farm.creator;`. Pass `isCreator` to the new component and render nothing when false. Non-owners see no panel and trigger zero extra network calls.

### Eligibility (owner view)

Read from existing `fetchFarmStakableConfig(farmName)` (React Query cached):

- `templates.length === 0` → panel hidden (farm stakes by schema/collection/attribute; out of scope).
- `templates.length > 50` → panel renders disabled with: "Template distribution unavailable — this farm accepts more than 50 templates."
- `1 ≤ templates.length ≤ 50` → panel renders with a "Compute distribution" button.

### Data sources (only after button click)

For each allowed template `{ collection, template_id }`:

1. **Issued / max supply + name + image** — `GET /atomicassets/v2/templates/{collection}/{template_id}`. One call per template. Concurrency 5. Cached `staleTime: 10m`.
2. **Staked count per template in this farm** — `GET /atomicassets/v2/assets?collection_name={c}&template_id={t}&owner={FARM_CONTRACT}&page=1&limit=1&count=true`. The `data` field returns the total count. One call per template. Concurrency 5.

Both go through `fetchWithFallback(ATOMIC_API.baseUrls, path)` — multi-endpoint fallback + 429 backoff already apply.

Total: ~2 × N calls (max 100 for a 50-template farm), ~2–3s end-to-end.

### UI

New component: `src/components/farm/FarmTemplateDistribution.tsx`

- Header: emoji + "Template Distribution" + small muted hint ("X templates · owner-only · click to compute").
- Idle: single "Compute distribution" button.
- Loading: skeleton rows, spinner on button, "X / Y templates loaded" progress.
- Loaded: list sorted by `% issued` desc. Each row:

  ```text
  [thumb 32x32] #template_id  Template Name              1,234 / 5,000 issued (24.7%)
                              collection · atomichub link  1,234 / 10,000 max (12.3%)
                              [progress bar — issued %]
  ```

- Failed templates show "—" with small retry icon.
- "Recompute" button after load (bypasses staleTime).
- `Collapsible` from `@/components/ui/collapsible`, collapsed by default.

### Wiring

`src/components/farm/FarmDetail.tsx` — render directly above `<FarmStakersTable />`, gated on `isCreator`:

```tsx
{isCreator && <FarmTemplateDistribution farmName={farmName} />}
```

### Technical details

New files:

- `src/lib/farmTemplateStats.ts`
  - `fetchTemplateStats(collection, templateId)` → `{ issued_supply, max_supply, name, image }`
  - `fetchTemplateStakedCount(collection, templateId)` → `number`
  - `TEMPLATE_DISTRIBUTION_MAX = 50`, `TEMPLATE_FETCH_CONCURRENCY = 5`
- `src/hooks/useFarmTemplateDistribution.ts`
  - Inputs: `farmName`, `templates: StakableTemplate[]`, `enabled: boolean`
  - `useQueries` returning per-template `{ templateId, collection, name, image, issuedSupply, maxSupply, stakedInFarm, issuedPct, maxPct, error }`
  - `staleTime: 10m`, `gcTime: 30m`. Internal p-limit-style helper caps in-flight at 5.
- `src/components/farm/FarmTemplateDistribution.tsx` — UI only, consumes the hook.

Reused: `fetchFarmStakableConfig` (cached), `ATOMIC_API.baseUrls` + `fetchWithFallback`, IPFS helpers from `src/lib/ipfsGateways.ts`.

### Out of scope

- Showing the panel to non-owners.
- Schema / collection grouping (deferred).
- Auto-loading (always manual button).
- Changes to `FarmStakersTable`, `useFarmStakers`, `farmStakers.ts`, daily-powerup workflow.
- Cross-session / localStorage persistence (React Query session cache only).

### Verification

- `/farm/cheesefarm` as creator: panel renders, button loads in < 2s, percentages match `atomichub.io`.
- `/farm/cheesefarm` as non-creator: panel does not render, no extra network calls.
- `/farm/pixeljourney` as creator (large staked, template-locked): no auto-load; click fires exactly 2×N atomic calls.
- Farm with > 50 templates (as creator): disabled message, no calls.
- Farm with 0 templates: panel hidden entirely.
- Recompute bypasses cache and refires.
- 429 / endpoint failure: per-row error state with retry.
