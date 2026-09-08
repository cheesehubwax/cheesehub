# CHEESEAir: equal-split and pro-rata modes for NFT drops

Today an NFT drop always gives exactly 1 NFT per selected recipient, in inventory order. This adds the same three distribution modes NFT drops that token and RAM drops already have.

## How it will work

The distribution step (box 3) shows the same three buttons in NFT mode:

- **Fixed each** — every recipient gets the same number of NFTs (default 1, which matches today's behaviour).
- **Equal split** — you enter a total number of NFTs to hand out; they are spread as evenly as possible across recipients. When the total does not divide evenly, the extra NFTs go to the highest-ranked recipients first (top of the holders list).
- **Pro-rata** — you enter a total number of NFTs; each recipient's share is proportional to their snapshot weight (token balance, NFT count, or LP value), rounded with largest-remainder so the handed-out total is exact. Recipients whose share rounds to zero are skipped and reported as such, exactly like RAM mode does.

Supporting details:

- The amount box label changes with the mode: "NFTs per holder" for fixed, "Total NFTs to send" for equal and pro-rata. The total defaults to how many NFTs of the chosen template you hold and is capped at that number.
- Pro-rata stays disabled when the snapshot has no weights, same rule as the other asset types.
- The summary box shows recipients included, recipients skipped, NFTs assigned, NFTs left over, and the transfer/transaction counts. The existing "not enough NFTs" warning still appears when the requested total exceeds your holdings.
- The holders list gains an "NFTs" column in NFT mode showing each recipient's assigned count.
- CSV export lists one row per recipient with all their asset ids.
- Memo, batch size, minimum-balance filter, the terms checkbox and the success dialog stay unchanged.

## Technical notes

- `src/lib/airdrop.ts`: replace `assignAssets` with a mode-aware allocator that first computes a per-recipient NFT count (fixed / even with rank-ordered remainder / largest-remainder pro-rata by weight) and then slices the asset pool in order, returning assignments (`account`, `assetIds: string[]`), `skipped`, `leftover`, and `shortfall`.
- `src/components/air/AirdropContext.tsx`: feed `mode`, `amountText`, and the selected holder rows (with weights) into the new allocator; expose the new counts. The NFT run loop already batches per action — each action now sends that recipient's full `asset_ids` array in a single `atomicassets::transfer`.
- `src/components/air/AirDistributionCard.tsx`: render the mode buttons plus amount input for NFT mode instead of the current static note.
- `src/components/air/AirCostPanel.tsx` and `AirHoldersTable.tsx`: show assigned NFT counts, skipped and leftover figures.
- Resource estimate keeps one transfer action per recipient; RAM per NFT is unchanged, so `estimateNftResources` is driven by recipient count as before.
- No smart-contract changes.
