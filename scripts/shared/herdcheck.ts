/**
 * HerdCheck endpoint health for the scheduled Bun scripts.
 *
 * The scripts keep their own vetted endpoint lists. Calling `applyHealthOrder`
 * once at start-up reorders a list in place so the hosts HerdCheck currently
 * reports as healthy come first and hosts reported as down are dropped. Any
 * failure leaves the static list untouched.
 */

const HERDCHECK_URL = "https://herdcheck.blocdraig.com/api/v1/wax/endpoints";
const TIMEOUT_MS = 5_000;

export type EndpointFeature = "chain-api" | "hyperion-v2" | "history-v1" | "atomic-assets-api";

const normalize = (url: string) => url.replace(/\/+$/, "");

interface HerdCheckEntry {
  url?: string;
  status?: string;
  uptimePercent?: number;
}

export interface HealthEntry {
  url: string;
  status: string;
  uptimePercent: number;
}

/** Current health per host for a feature. */
export async function fetchHealth(feature: EndpointFeature): Promise<HealthEntry[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HERDCHECK_URL}?feature=${feature}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HerdCheck returned ${res.status}`);
    const data = (await res.json()) as { endpoints?: HerdCheckEntry[] };
    return (data.endpoints ?? [])
      .filter((e): e is HerdCheckEntry & { url: string } => typeof e.url === "string")
      .map((e) => ({
        url: normalize(e.url),
        status: e.status ?? "healthy",
        uptimePercent: Number(e.uptimePercent) || 0,
      }));
  } finally {
    clearTimeout(timer);
  }
}

const RANK: Record<string, number> = { healthy: 0, degraded: 1 };

/**
 * Reorder `list` in place: our own hosts sorted by live health (healthy first,
 * best uptime first), hosts HerdCheck reports as down removed. Never throws.
 */
export async function applyHealthOrder(
  list: string[],
  feature: EndpointFeature,
): Promise<string[]> {
  try {
    const health = await fetchHealth(feature);
    if (health.length === 0) return list;
    const byUrl = new Map(health.map((h) => [h.url, h]));

    const rank = (status?: string) =>
      status === undefined ? 2 : (RANK[status] ?? 3);

    const next = list
      .map((url, index) => ({ url: normalize(url), entry: byUrl.get(normalize(url)), index }))
      .filter(({ entry }) => rank(entry?.status) < 3)
      .sort((a, b) => {
        const byStatus = rank(a.entry?.status) - rank(b.entry?.status);
        if (byStatus !== 0) return byStatus;
        if (a.entry && b.entry && a.entry.uptimePercent !== b.entry.uptimePercent) {
          return b.entry.uptimePercent - a.entry.uptimePercent;
        }
        return a.index - b.index;
      })
      .map(({ url }) => url);

    if (next.length === 0) return list;
    list.splice(0, list.length, ...next);
    console.log(`[herdcheck] ${feature}: ${next.length} hosts, ${next[0]} first.`);
    return list;
  } catch (error) {
    console.warn(`[herdcheck] ${feature} health read failed:`, (error as Error).message);
    return list;
  }
}
