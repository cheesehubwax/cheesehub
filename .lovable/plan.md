## Goal

Replace the deprecated WaxDAO unbox UI with a native CHEESEHub flow for opening **Waxy Wojak Packs** (collection `hoodpunknfts`, schema `wojakpacks`, template `515930`). Lives as a new section inside the existing CHEESEWallet sidebar dialog, grouped at the bottom alongside "Manage Alcor Farms". One pack per transaction.

## On-chain mechanics (verified)

Unbox = a single `atomicassets::transfer` from the connected user to `waxdaomarket`, with the pack NFT and a structured memo:

```text
from:  <user>
to:    waxdaomarket
asset_ids: ["<pack_asset_id>"]
memo:  |unbox|246|<pack_asset_id>|
```

`waxdaomarket` then burns the pack and pushes the resulting Wojak NFT back via `atomicassets::transfer` with memo `Asset transfer from WaxDAO` in the same trace. Confirmed against TX `f62cc2bb…` and 14 other fragglerockk unboxes.

Constants:
- `WAXDAO_UNBOX_CONTRACT = "waxdaomarket"`
- `WOJAK_UNBOX_POOL_ID = 246`
- `WOJAK_PACK_COLLECTION = "hoodpunknfts"`
- `WOJAK_PACK_SCHEMA    = "wojakpacks"`
- `WOJAK_PACK_TEMPLATE  = 515930`

## UX

New sidebar entry in `WalletTransferDialog`, added to the **bottom section** next to "Manage Alcor Farms" (i.e. `bottom: true`):

```text
📦 Open Wojak Pack
```

Panel contents:
1. Header with pack image (IPFS `QmcMHEk3SLzQEoYDykiCy1bJ6DuYy7fwQWsByVhfQuY7pL`), name, short blurb, link to `https://waxblock.io/account/waxdaomarket`.
2. **Your packs**: grid of every asset the connected user owns matching `collection=hoodpunknfts AND schema=wojakpacks`. Empty state: "No Wojak Packs in this wallet. Grab one on AtomicHub →".
3. Each card shows pack image, asset id, mint #, and an **Open Pack** button.
4. Click → mandatory Terms-of-Use checkbox dialog (`TermsDialog`) → on confirm, build + sign + broadcast the transfer above using the standard `useWaxTransaction` hook with Greymass Fuel plugins.
5. On success: route through `handleTransactionSuccess` so the standard `TransactionSuccessDialog` opens with the trx id. After ~6 s, refetch the user's `hoodpunknfts` assets and surface a toast "Pack opened — your new Wojak should arrive shortly".
6. Errors parsed via existing transaction error helper; surfaced via `sonner` toast.

Visual rules per project memory: yellow CHEESE accents, emoji-flanked title, 3-col mobile / 6-col desktop card grid.

## Files

New:
- `src/lib/wojakUnbox.ts` — exports the constants above plus `buildUnboxAction(user, packAssetId)` returning the WharfKit action object for `atomicassets::transfer`.
- `src/hooks/useWojakPacks.ts` — react-query hook calling AtomicAssets with the project's existing multi-endpoint fallback (`ATOMIC_API.baseUrls`): `/atomicassets/v1/assets?owner=<user>&collection_name=hoodpunknfts&schema_name=wojakpacks&page=1&limit=100&order=desc&sort=asset_id`. 30 s `staleTime`, manual invalidate after unbox.
- `src/components/wallet/WojakUnboxManager.tsx` — the panel UI, pack grid, open-button flow, Terms gate, success/error handling. Mirrors layout/style of existing `*Manager.tsx` siblings; accepts `onTransactionSuccess` prop like its peers.

Edited:
- `src/components/wallet/WalletTransferDialog.tsx`:
  - Add `"unbox-wojak"` to the `WalletSection` union.
  - Append `{ id: "unbox-wojak", label: "Open Wojak Pack", icon: Package, bottom: true }` (lucide `Package`) to `SIDEBAR_ITEMS` — placed in the bottom group so it renders below the separator alongside "Manage Alcor Farms".
  - Render `<WojakUnboxManager onTransactionSuccess={handleTransactionSuccess} />` when section is selected.

No other files change.

## Technical details

- Transaction built with `@wharfkit/session` via existing `useWaxTransaction` hook → automatically includes Greymass Fuel `getTransactPlugins()` per project rule.
- Authorization: `[{ actor: user, permission: 'active' }]`.
- Verify trx id in response; pass to `TransactionSuccessDialog`. Per project memory: never call this a "burn" — the success message uses "opened".
- After success, invalidate query keys: `['wojak-packs', user]` and any existing `['nfts', user, 'hoodpunknfts']` cache used by NFT viewers, so the burned pack disappears and the new Wojak appears once AtomicAssets reindexes.
- AtomicAssets fetch uses `fetchWithFallback(ATOMIC_API.baseUrls, …)` so it inherits the standard reliability behavior.

## Out of scope (explicit)

- No batch / "open all" — single pack per tx as requested.
- No support for other WaxDAO unbox pools — code is structured cleanly enough to add more pool IDs later, but the UI only exposes pool 246.
- No history view of past unboxes.
- No new top-level route — entry point is exclusively the CHEESEWallet sidebar (bottom group).

## Verification checklist

1. Build passes typecheck.
2. Sidebar shows "Open Wojak Pack" in the bottom group next to "Manage Alcor Farms", separated from the top items by the existing divider.
3. With a wallet holding ≥1 Waxy Wojak Pack, the new section lists it.
4. Clicking "Open Pack" produces a single `atomicassets::transfer` action with memo exactly `|unbox|246|<asset_id>|` (confirm in WharfKit signing modal).
5. After signing on mainnet, `waxblock.io/transaction/<trxid>` shows the full unbox trace (transfer → burnasset → transfer back).
6. Empty wallet shows the empty state, no errors.
