// =============================================================================
// Waxy Wojak Pack unbox (WaxDAO unbox pool 246)
// =============================================================================
// Unboxing a pack is a single atomicassets::transfer from the user to
// `waxdaomarket` with a structured memo. The contract then burns the pack and
// transfers the resulting Wojak NFT back to the user in the same trace.
//
// Memo format (verified against 15+ on-chain unboxes across multiple users
// and pools): `|unbox|<pool_id>|<random_nonce>|`
//
// The third segment is NOT the asset_id — it is a client-generated random
// nonce that the WaxDAO contract uses as the randomness seed for selecting
// which NFT to mint back. Every observed mainnet unbox uses a 9-digit number
// roughly in the 100_000_000 – 199_999_999 range, so we match that format
// exactly to stay 1:1 with the reference implementation.

export const WAXDAO_UNBOX_CONTRACT = 'waxdaomarket';
export const WOJAK_UNBOX_POOL_ID = 246;
export const WOJAK_PACK_COLLECTION = 'hoodpunknfts';
export const WOJAK_PACK_SCHEMA = 'wojakpacks';
export const WOJAK_PACK_TEMPLATE = '515930';

/**
 * Generate the client-side random nonce used in the unbox memo. Uses
 * crypto.getRandomValues when available so the seed isn't trivially
 * predictable, and matches the 9-digit shape (100_000_000 .. 199_999_999)
 * observed across every recorded WaxDAO unbox transaction.
 */
export function generateUnboxNonce(): number {
  const range = 100_000_000; // 1e8
  let r: number;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    r = buf[0] % range;
  } else {
    r = Math.floor(Math.random() * range);
  }
  return 100_000_000 + r;
}

/**
 * Build the atomicassets::transfer action that unboxes a single Waxy Wojak
 * pack via WaxDAO's unbox pool 246.
 *
 * Memo format (matched 1:1 against past successful mainnet unboxes):
 *   `|unbox|<pool_id>|<random_nonce>|`
 * where <random_nonce> is a fresh client-generated number, NOT the asset_id.
 */
export function buildUnboxAction(
  user: string,
  packAssetId: string,
  permission: unknown
) {
  const nonce = generateUnboxNonce();
  return {
    account: 'atomicassets',
    name: 'transfer',
    authorization: [permission],
    data: {
      from: user,
      to: WAXDAO_UNBOX_CONTRACT,
      asset_ids: [packAssetId],
      memo: `|unbox|${WOJAK_UNBOX_POOL_ID}|${nonce}|`,
    },
  };
}