import { BENCH_MS, STATIC_ENDPOINTS, benchEndpoint, clearBench, resolveEndpoints } from './endpointHealth';

export const WALLET_RPC_READ_TIMEOUT_MS = 3_500;
export const WALLET_RPC_WRITE_TIMEOUT_MS = 15_000;
const MAX_READ_ATTEMPTS = 4;

/** Transport-only fallback: never restart transact, re-sign, or retry a broadcast. */
export function createWalletRpcFetch(nativeFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)): typeof fetch {
  const origins = new Set(STATIC_ENDPOINTS['chain-api'].map((host) => new URL(host).origin));
  return async (input, init) => {
    // WharfKit FetchProvider uses URL strings. Other services (including Fuel)
    // and Request objects keep their own transport and semantics.
    if (typeof input !== 'string' && !(input instanceof URL)) return nativeFetch(input, init);
    const url = new URL(String(input));
    if (!origins.has(url.origin) || !url.pathname.startsWith('/v1/chain/')) return nativeFetch(input, init);

    const readOnly = /^\/v1\/chain\/get_[a-z_]+$/.test(url.pathname);
    const hosts = await resolveEndpoints('chain-api');
    const attempts = hosts.slice(0, readOnly ? MAX_READ_ATTEMPTS : 1);
    let lastError: unknown = new Error('No WAX RPC endpoints available');
    for (const host of attempts) {
      if (init?.signal?.aborted) throw init.signal.reason ?? new DOMException('Aborted', 'AbortError');
      const controller = new AbortController();
      const abort = () => controller.abort(init?.signal?.reason);
      init?.signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(), readOnly ? WALLET_RPC_READ_TIMEOUT_MS : WALLET_RPC_WRITE_TIMEOUT_MS);
      try {
        const headers = new Headers(init?.headers);
        if (init?.body != null) headers.set('Content-Type', 'text/plain;charset=UTF-8');
        const response = await nativeFetch(`${host}${url.pathname}${url.search}`, { ...init, headers, signal: controller.signal });
        // Buffer under the same timeout: receiving headers isn't a complete read.
        const text = await response.text();
        const buffered = new Response(response.status === 204 ? null : text, {
          status: response.status, statusText: response.statusText, headers: response.headers,
        });
        if (response.ok) { clearBench(host); return buffered; }
        const transient = response.status === 420 || response.status === 429 || response.status >= 500;
        if (!transient) return buffered;
        benchEndpoint(host, response.status === 420 || response.status === 429 ? BENCH_MS.rateLimited : BENCH_MS.error);
        // Even HTTP failures may follow an accepted broadcast. Return the original
        // response to WharfKit; it must not be resent here or reported successful.
        if (!readOnly) return buffered;
        lastError = new Error(`WAX RPC returned ${response.status}`);
      } catch (error) {
        if (init?.signal?.aborted) throw error;
        benchEndpoint(host, BENCH_MS.network);
        if (!readOnly) throw error;
        lastError = error;
      } finally {
        clearTimeout(timer);
        init?.signal?.removeEventListener('abort', abort);
      }
    }
    throw lastError;
  };
}

export const walletRpcFetch = createWalletRpcFetch();