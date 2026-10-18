import { describe, expect, it } from 'vitest';
import { isMusicNFT, nftMediaTracks } from '@/lib/nftMedia';
import { messageCost } from '@/lib/cheeseCrypt';
import { groupMessageCost } from '@/lib/cryptGroups';
import { nftToken, parseNftMessage } from '@/lib/cryptNft';

const r = (f: string) => `https://gw/${f}`;

describe('CHEESECrypt music NFTs', () => {
  it('picture-only NFTs have no tracks', () => {
    expect(isMusicNFT({ img: 'QmA' })).toBe(false);
    expect(nftMediaTracks({ img: 'QmA' }, r)).toEqual([]);
  });
  it('audio is the main track, distinct video becomes Full Track, extras follow', () => {
    expect(nftMediaTracks({ audio: 'a', video: 'v', track2: 't2', audio1: 'a1' }, r)).toEqual([
      { label: 'Main', url: 'https://gw/a' }, { label: 'Full Track', url: 'https://gw/v' },
      { label: 'Track 1', url: 'https://gw/a1' }, { label: 'Track 2', url: 'https://gw/t2' },
    ]);
  });
  it('clip-only and video-only NFTs are playable once', () => {
    expect(nftMediaTracks({ clip: 'c' }, r)).toEqual([{ label: 'Main', url: 'https://gw/c' }]);
    expect(nftMediaTracks({ video: 'v' }, r)).toEqual([{ label: 'Main', url: 'https://gw/v' }]);
  });
  it('a music attachment costs the NFT price: 0.021 in a DM, 0.023 with 3 group recipients', () => {
    const hasNft = parseNftMessage(nftToken('1099512345678')).some(s => s.type === 'nft');
    expect(messageCost(1, hasNft)).toBe('0.0210 CHEESE');
    expect(groupMessageCost(1, 3, hasNft)).toBe('0.0230 CHEESE');
  });
});
