// Fallback fetch utility for chain / AtomicAssets API reliability.
//
// The endpoint order is decided at read time by src/lib/endpointHealth.ts
// (HerdCheck's live node health), with the caller's own list kept as the
// offline fallback, so a dead node is never queued ahead of a healthy one.

import { resolveEndpoints, type EndpointFeature } from './endpointHealth';

/** Guess which HerdCheck feature a request path belongs to. */
export function featureForPath(path: string): EndpointFeature {
  if (path.startsWith('/v2/history') || path.startsWith('/v2/state')) return 'hyperion-v2';
  if (path.startsWith('/atomicassets') || path.startsWith('/atomicmarket')) {
    return 'atomic-assets-api';
  }
  return 'chain-api';
}

export async function fetchWithFallback(
  endpoints: string[],
  path: string,
  options?: RequestInit,
  timeout: number = 8000,
  feature: EndpointFeature = featureForPath(path)
): Promise<Response> {
  let lastError: Error | null = null;
  const ordered = await resolveEndpoints(feature, endpoints);

  for (const baseUrl of ordered) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // If response is not ok, try next endpoint
      console.warn(`Endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

// Helper to build URL with query params
export function buildApiUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, 'https://placeholder.com');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.pathname + url.search;
}
