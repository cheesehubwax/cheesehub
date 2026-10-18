import { describe, expect, it } from 'vitest';
import { isSfxNft } from '@/lib/nftMedia';

describe('sound-effect NFT detection', () => {
  it('a field set to sfx (any case) marks a sound effect', () => {
    expect(isSfxNft({ category: 'sfx' })).toBe(true);
    expect(isSfxNft({ Type: 'SFX' })).toBe(true);
  });
  it('an sfx flag set to true marks a sound effect', () => {
    expect(isSfxNft({ is_sfx: 0, sfx: 1 })).toBe(true);
  });
  it('songs are not sound effects', () => {
    expect(isSfxNft({ audio: 'Qm', category: 'music' })).toBe(false);
  });
});
