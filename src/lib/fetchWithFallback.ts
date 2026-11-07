// Fallback fetch utility for chain / AtomicAssets API reliability.
//
// The endpoint order is decided at read time by src/lib/endpointHealth.ts
// (HerdCheck's live node health), with the caller's own list kept as the
// offline fallback, so a dead node is never queued ahead of a healthy one.

import { BENCH_MS, benchEndpoint, clearBench, resolveEndpoints, type EndpointFeature } from './endpointHealth';

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
    const controller = new AbortController();
    const abort = () => controller.abort(options?.signal?.reason);
    if (options?.signal?.aborted) throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
    options?.signal?.addEventListener('abort', abort, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = new Headers(options?.headers);
      if (path.startsWith('/v1/chain/') && options?.body != null) headers.set('Content-Type', 'text/plain;charset=UTF-8');
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      const text = await response.text();

      if (response.ok) {
        clearBench(baseUrl);
        return new Response(response.status === 204 ? null : text, { status: response.status, statusText: response.statusText, headers: response.headers });
      }

      benchEndpoint(baseUrl, response.status === 420 || response.status === 429 ? BENCH_MS.rateLimited : BENCH_MS.error);

      // If response is not ok, try next endpoint
      console.warn(`Endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      benchEndpoint(baseUrl, BENCH_MS.network);
      lastError = error as Error;
      console.warn(`Endpoint ${baseUrl} failed:`, (error as Error).message);
    } finally {
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener('abort', abort);
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
