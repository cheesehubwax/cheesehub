// CHEESECrypt NFT sharing: an encrypted message may carry `[nft:<asset_id>]` tokens.
// Only the asset ID travels (inside the encrypted memo); the card is looked up from AtomicAssets.
export const MAX_NFTS_PER_MESSAGE = 4;
const TOKEN = /\[nft:(\d{1,20})\]/g;

export const nftToken = (assetId: string) => `[nft:${assetId}]`;

export type NftSegment = { type: 'text'; text: string } | { type: 'nft'; assetId: string };

/** Split message text into text and NFT segments; tokens past the cap stay plain text. */
export function parseNftMessage(text: string): NftSegment[] {
  const out: NftSegment[] = [];
  let last = 0, count = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (count >= MAX_NFTS_PER_MESSAGE) break;
    const before = text.slice(last, m.index).trim();
    if (before) out.push({ type: 'text', text: before });
    out.push({ type: 'nft', assetId: m[1] });
    last = m.index! + m[0].length; count++;
  }
  const rest = text.slice(last).trim();
  if (rest) out.push({ type: 'text', text: rest });
  return out;
}
