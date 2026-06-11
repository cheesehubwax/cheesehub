// =============================================================================
// Waxy Wojak Pack unbox (WaxDAO unbox pool 246)
// =============================================================================
// Unboxing a pack is a single atomicassets::transfer from the user to
// `waxdaomarket` with a structured memo. The contract then burns the pack and
// transfers the resulting Wojak NFT back to the user in the same trace.
//
// Verified against multiple on-chain transactions (see plan).

export const WAXDAO_UNBOX_CONTRACT = 'waxdaomarket';
export const WOJAK_UNBOX_POOL_ID = 246;
export const WOJAK_PACK_COLLECTION = 'hoodpunknfts';
export const WOJAK_PACK_SCHEMA = 'wojakpacks';
export const WOJAK_PACK_TEMPLATE = '515930';

/**
 * Build the atomicassets::transfer action that unboxes a single Waxy Wojak
 * pack via WaxDAO's unbox pool 246.
 *
 * The asset_id MUST also appear inside the memo, exactly matching the format
 * the WaxDAO contract expects: `|unbox|<pool_id>|<pack_asset_id>|`.
 */
export function buildUnboxAction(
  user: string,
  packAssetId: string,
  permission: { actor: string; permission: string }
) {
  return {
    account: 'atomicassets',
    name: 'transfer',
    authorization: [permission],
    data: {
      from: user,
      to: WAXDAO_UNBOX_CONTRACT,
      asset_ids: [packAssetId],
      memo: `|unbox|${WOJAK_UNBOX_POOL_ID}|${packAssetId}|`,
    },
  };
}