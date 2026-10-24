import { describe, expect, it } from 'vitest';
import { isMusicNFT, nftMediaTracks, normalizeNftMedia } from '@/lib/nftMedia';
import { extractIpfsHash } from '@/lib/ipfsGateways';
import { messageCost } from '@/lib/cheeseCrypt';
import { groupMessageCost } from '@/lib/cryptGroups';
import { nftToken, parseNftMessage } from '@/lib/cryptNft';

const r = (f: string) => `https://gw/${f}`;

describe('CHEESECrypt music NFTs', () => {
  it.each(['Audio', 'AUDIO', 'audio'])('detects and plays %s', (key) => {
    expect(isMusicNFT({ [key]: 'bafkreisound' })).toBe(true);
    expect(nftMediaTracks({ [key]: 'bafkreisound' }, r)).toEqual([{ label: 'Main', url: 'https://gw/bafkreisound' }]);
  });
  it.each(['Sound', 'MP3', 'Sfx'])('plays references from %s', (key) => {
    expect(nftMediaTracks({ [key]: 'ipfs://bafkreisound' }, r)).toEqual([{ label: 'Main', url: 'https://gw/ipfs://bafkreisound' }]);
  });
  it('never treats tags, numbers or booleans as audio', () => {
    expect(isMusicNFT({ category: 'sfx', sfx: true, sound: 'fart', audio: 1 })).toBe(false);
    expect(nftMediaTracks({ sfx: 'sfx', Audio: '  ' }, r)).toEqual([]);
  });
  it('keeps canonical precedence and supports uppercase video, clip and extras', () => {
    expect(normalizeNftMedia({ audio: 'a', Audio: 'other', sound: 'https://sound' }).audio).toBe('a');
    expect(nftMediaTracks({ Audio: 'a', Video: 'v', 'TRACK 2': 't2' }, r)).toEqual([
      { label: 'Main', url: 'https://gw/a' }, { label: 'Full Track', url: 'https://gw/v' }, { label: 'Track 2', url: 'https://gw/t2' },
    ]);
    expect(nftMediaTracks({ Clip: 'c' }, r)).toEqual([{ label: 'Main', url: 'https://gw/c' }]);
  });
  it('recognizes raw bafk CIDs for chat gateway fallback', () => {
    expect(extractIpfsHash('bafkreisound')).toBe('bafkreisound');
  });
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
  it('a music attachment costs the NFT price: 0.0201 in a DM, 0.0203 with 3 group recipients', () => {
    const hasNft = parseNftMessage(nftToken('1099512345678')).some(s => s.type === 'nft');
    expect(messageCost(1, hasNft)).toBe('0.0201 CHEESE');
    expect(groupMessageCost(1, 3, hasNft)).toBe('0.0203 CHEESE');
  });
});
