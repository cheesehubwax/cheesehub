import { describe, expect, it } from 'vitest';
import { MAX_NFTS_PER_MESSAGE, nftToken, parseNftMessage } from '@/lib/cryptNft';

describe('CHEESECrypt NFT tokens', () => {
  it('splits text around an NFT token', () => {
    expect(parseNftMessage(`look ${nftToken('1099512345678')} nice`)).toEqual([
      { type: 'text', text: 'look' }, { type: 'nft', assetId: '1099512345678' }, { type: 'text', text: 'nice' },
    ]);
  });
  it('ignores non-numeric ids', () => {
    expect(parseNftMessage('[nft:abc]')).toEqual([{ type: 'text', text: '[nft:abc]' }]);
  });
  it('caps cards per message', () => {
    const text = Array.from({ length: MAX_NFTS_PER_MESSAGE + 1 }, (_, i) => nftToken(String(i + 1))).join(' ');
    expect(parseNftMessage(text).filter(s => s.type === 'nft')).toHaveLength(MAX_NFTS_PER_MESSAGE);
  });
});
