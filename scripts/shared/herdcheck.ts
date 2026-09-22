/**
 * HerdCheck endpoint health for the scheduled Bun scripts.
 *
 * The scripts keep their own static endpoint lists as the offline fallback.
 * Calling `applyHealthOrder` once at start-up reorders a list in place so the
 * hosts that HerdCheck currently reports as up are tried first, and hosts that
 * are down are dropped. Any failure leaves the static list untouched.
 */

const HERDCHECK_URL = "https://herdcheck.blocdraig.com/api/v1/wax/endpoints";
const TIMEOUT_MS = 5_000;
const MAX_ENDPOINTS = 8;

export type EndpointFeature = "chain-api" | "hyperion-v2" | "history-v1" | "atomic-assets-api";

const normalize = (url: string) => url.replace(/\/+$/, "");

interface HerdCheckEntry {
  url?: string;
  status?: string;
  uptimePercent?: number;
}

/** Hosts HerdCheck currently reports as up for a feature, best first. */
export async function healthyEndpoints(feature: EndpointFeature): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HERDCHECK_URL}?feature=${feature}&status=up`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HerdCheck returned ${res.status}`);
    const data = (await res.json()) as { endpoints?: HerdCheckEntry[] };
    return (data.endpoints ?? [])
      .filter((e) => typeof e.url === "string" && (e.status === "healthy" || e.status === "degraded"))
      .map((e) => normalize(e.url as string));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reorder `list` in place: healthy hosts first (HerdCheck order), then the
 * script's own hosts that HerdCheck does not list. Never throws.
 */
export async function applyHealthOrder(
  list: string[],
  feature: EndpointFeature,
  limit = MAX_ENDPOINTS,
): Promise<string[]> {
  try {
    const healthy = await healthyEndpoints(feature);
    if (healthy.length === 0) return list;

    const healthySet = new Set(healthy);
    const original = list.map(normalize);
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const url of healthy) {
      if (seen.has(url)) continue;
      seen.add(url);
      ordered.push(url);
    }
    // Keep our own hosts that HerdCheck does not monitor as a last resort.
    for (const url of original) {
      if (seen.has(url) || healthySet.has(url)) continue;
      seen.add(url);
      ordered.push(url);
    }

    const next = ordered.slice(0, limit);
    list.splice(0, list.length, ...next);
    console.log(`[herdcheck] ${feature}: using ${next.length} hosts, ${next[0]} first.`);
    return list;
  } catch (error) {
    console.warn(`[herdcheck] ${feature} health read failed:`, (error as Error).message);
    return list;
  }
}
