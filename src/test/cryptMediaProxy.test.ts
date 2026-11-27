import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveCustomEndpoint } from '@/lib/cryptNetworkPrivacy';
import { __resetMediaRouteCache, currentMediaRoute, decideMediaRoute, decideRespectRoute, resolveMediaRoute, routedImageUrl, routedMediaCandidates, torMediaUrl } from '@/lib/cryptMediaProxy';

const CID = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
const H = 'http://localhost:8088';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('chat NFT media routing through the Tor helper', () => {
  beforeEach(() => { localStorage.clear(); __resetMediaRouteCache(); });

  it('uses public servers when no loopback helper is saved', () => {
    expect(decideMediaRoute(null, null)).toEqual({ kind: 'public' });
    expect(decideMediaRoute('https://my.node', 'media')).toEqual({ kind: 'public' });
  });

  it('never leaks to public gateways while the saved helper is unknown or down', () => {
    expect(decideMediaRoute(H, null).kind).toBe('blocked');
    expect(decideMediaRoute(H, 'down').kind).toBe('blocked');
    const r = decideMediaRoute(H, 'down');
    expect(routedImageUrl(r, `https://ipfs.io/ipfs/${CID}`)).toBeNull();
    expect(routedMediaCandidates(r, `https://ipfs.io/ipfs/${CID}`, ['https://ipfs.io/x'])).toEqual([]);
  });

  it('sends IPFS media only to the helper, and drops non-IPFS media', () => {
    const r = decideMediaRoute(H, 'media');
    expect(routedMediaCandidates(r, `https://dweb.link/ipfs/${CID}/a.mp3`, ['public'])).toEqual([`${H}/ipfs/${CID}/a.mp3`]);
    expect(routedImageUrl(r, `https://resizer.atomichub.io/images/v1/preview?ipfs=${CID}&size=370`)).toBe(`${H}/ipfs/${CID}`);
    expect(routedImageUrl(r, 'https://example.com/pic.png')).toBeNull();
    expect(torMediaUrl(H, `ipfs://${CID}/../x`)).toBeNull();
  });

  it('a pre-1.3 helper keeps the public route as before', async () => {
    saveCustomEndpoint(H, true);
    const f = vi.fn().mockResolvedValue(json({ error: 'Only WAX history' }, 403));
    expect((await resolveMediaRoute(f as unknown as typeof fetch)).kind).toBe('legacy');
    expect(String(f.mock.calls[0][0])).toBe(`${H}/v2/helper`);
  });

  it('a v1.3 helper becomes the only route; unreachable means blocked', async () => {
    saveCustomEndpoint(H, false);
    expect(currentMediaRoute().kind).toBe('blocked');
    const ok = vi.fn().mockResolvedValue(json({ features: ['history', 'broadcast', 'atomic', 'ipfs'] }));
    expect(await resolveMediaRoute(ok as unknown as typeof fetch)).toEqual({ kind: 'tor', base: H });
    __resetMediaRouteCache();
    const down = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await resolveMediaRoute(down as unknown as typeof fetch)).kind).toBe('blocked');
  });
});

describe('Respect route', () => {
  it('uses Tor only for a v1.4 helper, public for older helpers, and fails closed when down', () => {
    expect(decideMediaRoute(H, 'full')).toEqual({ kind: 'tor', base: H });
    expect(decideRespectRoute(H, 'full')).toEqual({ kind: 'tor', base: H });
    expect(decideRespectRoute(H, 'media').kind).toBe('legacy');
    expect(decideRespectRoute(H, 'legacy').kind).toBe('legacy');
    expect(decideRespectRoute(H, 'down').kind).toBe('blocked');
    expect(decideRespectRoute(H, null).kind).toBe('blocked');
    expect(decideRespectRoute('https://my.node', 'full')).toEqual({ kind: 'public' });
  });
});
