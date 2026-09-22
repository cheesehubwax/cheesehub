// Health-aware WAX endpoint ordering.
//
// Why this exists: every reader in this app used to loop over a frozen list of
// hosts. When one of those hosts dies (wax.pink.gg and wax.blokcrafters.io both
// sat at 0% uptime for weeks) every read that reaches it burns a full timeout,
// which is exactly how "the history is slow" feels from the outside.
//
// HerdCheck (https://herdcheck.blocdraig.com) publishes a free, CORS-enabled
// JSON list of monitored Antelope endpoints per feature, ordered by uptime. We
// read it, cache it for a few minutes, and use it to ORDER our own reads. The
// hardcoded lists stay as the fallback, so a HerdCheck outage can never take
// CHEESEHub's data down with it.

const HERDCHECK_URL = 'https://herdcheck.blocdraig.com/api/v1/wax/endpoints';

/** Feature names as HerdCheck defines them. */
export type EndpointFeature =
  | 'chain-api'
  | 'hyperion-v2'
  | 'history-v1'
  | 'atomic-assets-api';

/** Hosts confirmed dead — never queued, no matter which list names them. */
export const DEAD_ENDPOINTS = ['https://wax.pink.gg', 'https://wax.blokcrafters.io'];

/**
 * Built-in fallback order, used until (or instead of) a health read.
 *
 * PROVEN HOSTS FIRST. Live health decides the order WITHIN this list and drops
 * hosts reported down, but it must never promote a host we have not served real
 * browser traffic from: wax.hivebp.io is ranked healthiest by the monitor and
 * still answers "Failed to fetch" in some visitors' browsers, and leading with
 * it blanked every stat on the site (2026-09-22). Newly discovered hosts sit at
 * the back of each list as extra cover only.
 */
export const STATIC_ENDPOINTS: Record<EndpointFeature, string[]> = {
  'chain-api': [
    'https://wax.eosusa.io',
    'https://api.waxsweden.org',
    'https://wax.greymass.com',
    'https://wax.cryptolions.io',
    'https://wax.eosdac.io',
    'https://api.wax.alohaeos.com',
    'https://wax.eosphere.io',
    'https://wax.hivebp.io',
  ],
  'hyperion-v2': [
    'https://wax.eosusa.io',
    'https://wax.cryptolions.io',
    'https://api.waxsweden.org',
    'https://wax.eosphere.io',
    'https://wax.eosdac.io',
    'https://wax.hivebp.io',
  ],
  'history-v1': [
    'https://api.waxsweden.org',
    'https://wax.eosusa.io',
    'https://wax.cryptolions.io',
    'https://wax.eosphere.io',
    'https://wax.hivebp.io',
  ],
  'atomic-assets-api': [
    'https://wax.api.atomicassets.io',
    'https://aa.wax.blacklusion.io',
    'https://wax-aa.eu.eosamsterdam.net',
    'https://atomic.wax.eosrio.io',
    'https://wax-atomic-api.eosphere.io',
    'https://atomic.hivebp.io',
  ],
};

/** Never queue more than this many hosts for one read. */
export const MAX_ENDPOINTS = 8;

const CACHE_TTL_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 4_000;

export type EndpointStatus = 'healthy' | 'degraded' | 'stale' | 'down' | 'invalid';

export interface HealthEntry {
  url: string;
  status: EndpointStatus;
  uptimePercent: number;
  producer: string;
}

interface CacheSlot {
  at: number;
  entries: HealthEntry[];
}

const cache = new Map<EndpointFeature, CacheSlot>();
const inFlight = new Map<EndpointFeature, Promise<HealthEntry[]>>();

/** Drop trailing slashes so our lists and HerdCheck's compare cleanly. */
export const normalizeEndpoint = (url: string): string => url.replace(/\/+$/, '');

const isDead = (url: string): boolean => DEAD_ENDPOINTS.includes(normalizeEndpoint(url));

interface HerdCheckEntry {
  url?: string;
  status?: string;
  uptimePercent?: number;
  producer?: { owner?: string; name?: string };
}

async function requestHealth(feature: EndpointFeature): Promise<HealthEntry[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${HERDCHECK_URL}?feature=${feature}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HerdCheck returned ${res.status}`);
    const data = (await res.json()) as { endpoints?: HerdCheckEntry[] };
    const entries: HealthEntry[] = [];
    for (const raw of data.endpoints ?? []) {
      const url = typeof raw.url === 'string' ? normalizeEndpoint(raw.url) : '';
      if (!url || isDead(url)) continue;
      entries.push({
        url,
        status: (raw.status as EndpointStatus) ?? 'healthy',
        uptimePercent: Number(raw.uptimePercent) || 0,
        producer: raw.producer?.name || raw.producer?.owner || 'unknown',
      });
    }
    return entries;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Current health for a feature, cached for 5 minutes. Never throws: a failed
 * read yields an empty list and callers fall back to the static order.
 */
export async function fetchEndpointHealth(feature: EndpointFeature): Promise<HealthEntry[]> {
  const slot = cache.get(feature);
  if (slot && Date.now() - slot.at < CACHE_TTL_MS) return slot.entries;

  const pending = inFlight.get(feature);
  if (pending) return pending;

  const promise = requestHealth(feature)
    .then((entries) => {
      if (entries.length > 0) cache.set(feature, { at: Date.now(), entries });
      return entries;
    })
    .catch((error) => {
      console.warn(`[endpointHealth] ${feature} health read failed:`, (error as Error).message);
      // Remember the failure briefly so every reader does not retry at once.
      cache.set(feature, { at: Date.now(), entries: cache.get(feature)?.entries ?? [] });
      return cache.get(feature)?.entries ?? [];
    })
    .finally(() => {
      inFlight.delete(feature);
    });

  inFlight.set(feature, promise);
  return promise;
}

/**
 * Order our OWN vetted hosts by live health, then append any other currently
 * healthy host as a last resort.
 *
 * Vetted-first matters: the published list contains hosts that answer a plain
 * GET but reject a browser CORS preflight for POST /v1/chain/*, so leading with
 * an unknown host would slow every read down. Health decides the ORDER of hosts
 * we already trust; unknown healthy hosts only ever act as a safety net.
 */
export function mergeEndpoints(
  healthy: HealthEntry[],
  fallback: string[],
  limit = MAX_ENDPOINTS,
): string[] {
  const byUrl = new Map<string, HealthEntry>();
  for (const entry of healthy) byUrl.set(normalizeEndpoint(entry.url), entry);

  const rank = (status?: EndpointStatus) =>
    status === 'healthy' ? 0 : status === 'degraded' ? 1 : status === undefined ? 2 : 3;

  const vetted = fallback
    .map(normalizeEndpoint)
    .filter((url, i, all) => url && !isDead(url) && all.indexOf(url) === i)
    .map((url, index) => ({ url, entry: byUrl.get(url), index }))
    // Down hosts are dropped outright; unmonitored ones keep their own order.
    .filter(({ entry }) => rank(entry?.status) < 3)
    .sort((a, b) => {
      const byStatus = rank(a.entry?.status) - rank(b.entry?.status);
      if (byStatus !== 0) return byStatus;
      const byUptime = (b.entry?.uptimePercent ?? 0) - (a.entry?.uptimePercent ?? 0);
      if (byUptime !== 0 && a.entry && b.entry) return byUptime;
      return a.index - b.index;
    })
    .map(({ url }) => url);

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    const clean = normalizeEndpoint(url);
    if (!clean || isDead(clean) || seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };

  for (const url of vetted) push(url);
  for (const entry of healthy) if (entry.status === 'healthy') push(entry.url);

  return out.slice(0, limit);
}

/**
 * The endpoint order to use for a read. Awaits the (cached) health list, and
 * falls back to `fallback` when HerdCheck is unreachable.
 */
export async function resolveEndpoints(
  feature: EndpointFeature,
  fallback: string[] = STATIC_ENDPOINTS[feature],
  limit = MAX_ENDPOINTS,
): Promise<string[]> {
  const healthy = await fetchEndpointHealth(feature).catch(() => [] as HealthEntry[]);
  return mergeEndpoints(healthy, fallback, limit);
}

/**
 * Synchronous variant for call sites that cannot await: returns the cached
 * order if we have one and refreshes in the background otherwise.
 */
export function cachedEndpoints(
  feature: EndpointFeature,
  fallback: string[] = STATIC_ENDPOINTS[feature],
  limit = MAX_ENDPOINTS,
): string[] {
  const slot = cache.get(feature);
  if (!slot || Date.now() - slot.at >= CACHE_TTL_MS) {
    void fetchEndpointHealth(feature).catch(() => []);
  }
  return mergeEndpoints(slot?.entries ?? [], fallback, limit);
}

/** Warm the cache for the features the app reads most. */
export function primeEndpointHealth(): void {
  for (const feature of ['chain-api', 'hyperion-v2', 'atomic-assets-api'] as EndpointFeature[]) {
    void fetchEndpointHealth(feature).catch(() => []);
  }
}

/** Test-only: forget every cached health answer. */
export function resetEndpointHealthCache(): void {
  cache.clear();
  inFlight.clear();
}
