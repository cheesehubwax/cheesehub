import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  atomicHubImageUrl, buildIpfsImageUrl, getIpfsUrl,
  ipfsImageCandidates, preferredIpfsImageUrl, raceIpfsImage,
} from '@/lib/ipfsGateways';

const hash = 'QmcyKFxZWFMFJAmjuowJ4F1DUzGGUpEFDV6Co4mV9Dx5ND';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('NFT artwork resolution', () => {
  it('starts Sound 2 artwork at the image cache without waiting for an IPFS timeout', () => {
    expect(preferredIpfsImageUrl(`https://gateway.pinata.cloud/ipfs/${hash}`)).toBe(atomicHubImageUrl(hash));
    expect(preferredIpfsImageUrl(`ipfs://${hash}`)).toBe(atomicHubImageUrl(hash));
    expect(buildIpfsImageUrl(0, hash)).toBe(atomicHubImageUrl(hash));
    expect(ipfsImageCandidates(hash)[0]).toBe(atomicHubImageUrl(hash));
  });

  it('keeps plain content gateways for audio/video and as artwork fallbacks', () => {
    const original = getIpfsUrl(hash);
    expect(original).not.toContain('resizer.atomichub.io');
    expect(ipfsImageCandidates(hash).slice(1)).toContain(original);
    expect(preferredIpfsImageUrl('https://example.com/art.png')).toBe('https://example.com/art.png');
  });

  it('retains bundled copies ahead of third-party artwork', () => {
    const bundledHash = 'QmYTvGVY8eVxrzYf7VTgqJJqZiNJF7gAfji6ewxo4qUyeM';
    const preferred = preferredIpfsImageUrl(`ipfs://${bundledHash}`);
    expect(preferred).not.toContain('resizer.atomichub.io');
    expect(ipfsImageCandidates(bundledHash)).toEqual([preferred]);
  });

  it('resolves cached artwork even when every public gateway hangs', async () => {
    vi.useFakeTimers();
    class FakeImage {
      naturalWidth = 370;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(url: string) {
        if (url.includes('resizer.atomichub.io')) {
          setTimeout(() => this.onload?.(), 100);
        }
      }
    }
    vi.stubGlobal('Image', FakeImage);
    const result = raceIpfsImage(hash, 8000);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual({ url: atomicHubImageUrl(hash), index: 0 });
  });
});