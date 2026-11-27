import { describe, expect, it } from 'vitest';
import { preferredIpfsImageUrl } from '@/lib/ipfsGateways';
import { routedImageUrl } from '@/lib/cryptMediaProxy';

const SOUND2 = 'QmcyKFxZWFMFJAmjuowJ4F1DUzGGUpEFDV6Co4mV9Dx5ND';

describe('cheesenftwax sound effect artwork', () => {
  it('uses the built-in copy instead of a public gateway', () => {
    expect(preferredIpfsImageUrl(SOUND2)).not.toMatch(/^https?:/);
  });
  it('stays local under the Tor helper route', () => {
    const url = routedImageUrl({ kind: 'tor', base: 'http://127.0.0.1:8088' }, SOUND2);
    expect(url).toBe(preferredIpfsImageUrl(SOUND2));
  });
});
