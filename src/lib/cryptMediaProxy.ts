// CHEESECrypt NFT media routing through the user's own loopback Tor helper (v1.3+).
// When a loopback helper is saved as the custom history server, chat NFT metadata
// (AtomicAssets) and IPFS artwork/audio/video go only through that helper, never
// directly to public APIs or gateways. If the helper is configured but unreachable,
// media fails closed instead of silently falling back to public servers.
import { extractIpfsHash, preferredIpfsImageUrl } from '@/lib/ipfsGateways';
import { loadCustomEndpoint } from '@/lib/cryptNetworkPrivacy';
import { fetchAssetById } from '@/services/atomicApi';

export type MediaRoute =
  | { kind: 'public' }
  | { kind: 'tor'; base: string }
  | { kind: 'legacy'; base: string }   // helper answers but predates media routing: public, as before v1.3
  | { kind: 'blocked'; base: string }; // helper configured but unreachable: fail closed

export type ProbeResult = 'media' | 'legacy' | 'down';

const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/;
export const isLoopbackHelper = (url: string | null): url is string => !!url && LOOPBACK.test(url);

/** Pure routing rule: which path chat NFT media may take for a saved server and probe outcome. */
export function decideMediaRoute(custom: string | null, probe: ProbeResult | null): MediaRoute {
  if (!isLoopbackHelper(custom)) return { kind: 'public' };
  if (probe === 'media') return { kind: 'tor', base: custom };
  if (probe === 'legacy') return { kind: 'legacy', base: custom };
  return { kind: 'blocked', base: custom }; // unknown or down never leaks
}

/** Helper media URL for an IPFS (or AtomicHub-resizer) URL; null when it is not IPFS content. */
export function torMediaUrl(base: string, url: string): string | null {
  const hash = extractIpfsHash(url);
  if (!hash) return null;
  const clean = hash.split(/[?#]/)[0];
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(\/[^/]+)*$/.test(clean) || clean.split('/').some(s => s === '.' || s === '..')) return null;
  return `${base}/ipfs/${clean}`;
}

/** Image source under a route: bundled copies stay local, IPFS goes via the helper, nothing else loads. */
export function routedImageUrl(route: MediaRoute, url: string): string | null {
  if (route.kind === 'public' || route.kind === 'legacy') return url;
  if (route.kind === 'blocked') return null;
  const preferred = preferredIpfsImageUrl(url);
  if (!/^https?:\/\//i.test(preferred)) return preferred; // same-origin bundled asset
  return torMediaUrl(route.base, url);
}

/** Audio/video candidates under a route. Public keeps the given list; Tor allows only the helper. */
export function routedMediaCandidates(route: MediaRoute, url: string, publicList: string[]): string[] {
  if (route.kind === 'public' || route.kind === 'legacy') return publicList;
  if (route.kind === 'blocked') return [];
  const u = torMediaUrl(route.base, url);
  return u ? [u] : [];
}

const DOWN_RETRY_MS = 30_000;
let cached: { base: string; probe: ProbeResult; at: number } | null = null;
let inflight: { base: string; p: Promise<ProbeResult> } | null = null;

export async function probeHelper(base: string, fetcher: typeof fetch = fetch): Promise<ProbeResult> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetcher(`${base}/v2/helper`, { signal: ctl.signal, cache: 'no-store' });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      return Array.isArray(j?.features) && j.features.includes('ipfs') && j.features.includes('atomic') ? 'media' : 'legacy';
    }
    return r.status === 403 || r.status === 404 ? 'legacy' : 'down';
  } catch { return 'down'; } finally { clearTimeout(t); }
}

/** Current route without network: blocked until a probe for the saved helper has answered. */
export function currentMediaRoute(): MediaRoute {
  const custom = loadCustomEndpoint();
  if (!isLoopbackHelper(custom)) return { kind: 'public' };
  return decideMediaRoute(custom, cached?.base === custom ? cached.probe : null);
}

export async function resolveMediaRoute(fetcher: typeof fetch = fetch): Promise<MediaRoute> {
  const custom = loadCustomEndpoint();
  if (!isLoopbackHelper(custom)) return { kind: 'public' };
  const fresh = cached && cached.base === custom && (cached.probe !== 'down' || Date.now() - cached.at < DOWN_RETRY_MS);
  if (!fresh) {
    if (!inflight || inflight.base !== custom) {
      const p = probeHelper(custom, fetcher);
      inflight = { base: custom, p };
      p.then(probe => { cached = { base: custom, probe, at: Date.now() }; if (inflight?.p === p) inflight = null; });
    }
    await inflight.p;
  }
  return currentMediaRoute();
}

export class MediaBlockedError extends Error {
  constructor() { super('Tor helper not reachable'); this.name = 'MediaBlockedError'; }
}

/** Chat NFT metadata lookup that honours the media route. */
export async function fetchCryptAsset(assetId: string) {
  const route = await resolveMediaRoute();
  if (route.kind === 'blocked') throw new MediaBlockedError();
  return route.kind === 'tor' ? fetchAssetById(assetId, route.base) : fetchAssetById(assetId);
}

/** Test hook. */
export const __resetMediaRouteCache = () => { cached = null; inflight = null; };
