// =============================================================================
// Hedged chain reads.
//
// Two lessons, both learned the hard way on 2026-09-22:
//
// 1. A host that never answers must not cost a page. Waiting a full timeout on
//    the first host is what turned "wax.hivebp.io is unreachable from this
//    browser" into "the site shows no price, no supply, nothing". So reads are
//    HEDGED: if the first host has not answered within HEDGE_MS, a second
//    attempt starts alongside it on another host and the first answer home
//    wins. A dead host costs a couple of seconds, once.
//
// 2. Chain reads are sent as `text/plain`, NOT `application/json`. A JSON
//    content type makes the request "non-simple", so the browser sends an
//    OPTIONS preflight first — and wax.greymass.com answers that preflight with
//    a 400, which the browser reports as a CORS failure. nodeos parses the body
//    regardless of the header. (Verified: greymass returns 400 to the preflight
//    while the POST itself is fine.)
//
// Failing hosts are benched in endpointHealth so the next read skips them.
// =============================================================================

import {
  BENCH_MS,
  benchEndpoint,
  clearBench,
  resolveEndpoints,
  type EndpointFeature,
} from './endpointHealth';

/** A healthy WAX node answers a 1000-row table read well inside 1.5s. */
export const REQ_TIMEOUT_MS = 9_000;
/** Start a second host after this long rather than waiting out the first. */
export const HEDGE_MS = 2_200;
/** Most hosts we will ever launch for one read. */
export const MAX_TRIES = 4;
/** Most chain reads in flight at once — fast without looking like an attack. */
export const MAX_CONCURRENT = 6;

export interface HedgedOptions<T> {
  /** Which endpoint roster to read from. */
  feature?: EndpointFeature;
  /** Offline order, used when the health service is unreachable. */
  fallback?: string[];
  method?: 'GET' | 'POST';
  body?: unknown;
  tries?: number;
  hedgeMs?: number;
  timeoutMs?: number;
  /**
   * Turn a specific unsuccessful status into a valid answer — e.g. a missing
   * contract answers get_currency_balance with 400, which means "no balance",
   * not "try another host".
   */
  onStatus?: (status: number) => { value: T } | undefined;
}

export interface HedgedResult<T> {
  data: T;
  /** Which host answered. */
  host: string;
}

let cursor = 0;

/** Next host to try, round-robin, so load spreads instead of piling on one. */
function nextHost(hosts: string[], used: Set<string>): string | null {
  for (let i = 0; i < hosts.length; i += 1) {
    const host = hosts[(cursor + i) % hosts.length];
    if (!used.has(host)) {
      cursor = (cursor + i + 1) % hosts.length;
      return host;
    }
  }
  return null;
}

class HttpStatusError extends Error {
  constructor(readonly status: number, host: string) {
    super(`${host} returned ${status}`);
  }
}

async function attempt<T>(
  host: string,
  path: string,
  options: HedgedOptions<T>,
  timeoutMs: number,
): Promise<HedgedResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${host}${path}`, {
      method: options.method ?? 'POST',
      // text/plain on purpose — see the file header.
      headers:
        options.method === 'GET'
          ? undefined
          : { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: options.method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
      signal: controller.signal,
    });
  } catch (error) {
    // Timeout, network failure or CORS rejection: bench it hard.
    benchEndpoint(host, BENCH_MS.network);
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const mapped = options.onStatus?.(response.status);
    if (mapped) {
      clearBench(host);
      return { data: mapped.value, host };
    }
    benchEndpoint(
      host,
      response.status === 420 || response.status === 429 ? BENCH_MS.rateLimited : BENCH_MS.error,
    );
    throw new HttpStatusError(response.status, host);
  }

  const data = (await response.json()) as T;
  clearBench(host);
  return { data, host };
}

/**
 * Read JSON from the chain with hedging, benching and host rotation.
 * Resolves with the first answer home; rejects only when every attempt failed.
 */
export async function hedgedJson<T>(
  path: string,
  options: HedgedOptions<T> = {},
): Promise<HedgedResult<T>> {
  const feature = options.feature ?? 'chain-api';
  const hosts = await resolveEndpoints(feature, options.fallback);
  if (hosts.length === 0) throw new Error(`No ${feature} endpoints available`);

  const tries = Math.min(options.tries ?? MAX_TRIES, hosts.length);
  const hedgeMs = options.hedgeMs ?? HEDGE_MS;
  const timeoutMs = options.timeoutMs ?? REQ_TIMEOUT_MS;

  return new Promise<HedgedResult<T>>((resolve, reject) => {
    const used = new Set<string>();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let launched = 0;
    let finished = 0;
    let settled = false;
    let lastError: unknown = null;

    const finish = (fn: () => void) => {
      settled = true;
      for (const timer of timers) clearTimeout(timer);
      fn();
    };

    const launch = () => {
      if (settled || launched >= tries) return;
      const host = nextHost(hosts, used);
      if (!host) {
        // Nothing left to try and nothing in flight — give up.
        if (finished >= launched && !settled) {
          finish(() =>
            reject(lastError instanceof Error ? lastError : new Error(`${path}: unreachable`)),
          );
        }
        return;
      }
      used.add(host);
      launched += 1;

      attempt<T>(host, path, options, timeoutMs).then(
        (result) => {
          if (!settled) finish(() => resolve(result));
        },
        (error) => {
          lastError = error;
          finished += 1;
          if (settled) return;
          console.warn(`[chain] ${host}${path} failed:`, (error as Error).message);
          if (finished >= launched) {
            if (launched < tries) launch();
            else
              finish(() =>
                reject(lastError instanceof Error ? lastError : new Error(`${path}: unreachable`)),
              );
          }
        },
      );

      // Hedge: don't wait out a silent host.
      if (launched < tries) {
        timers.push(
          setTimeout(() => {
            if (!settled) launch();
          }, hedgeMs),
        );
      }
    };

    launch();
  });
}

/** Convenience wrapper: just the parsed body. */
export async function chainPost<T>(
  path: string,
  body: Record<string, unknown>,
  options: Omit<HedgedOptions<T>, 'body' | 'method'> = {},
): Promise<T> {
  const { data } = await hedgedJson<T>(path, { ...options, method: 'POST', body });
  return data;
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const out = new Array<O>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        out[index] = await fn(items[index], index);
      }
    }),
  );
  return out;
}

/** Test-only: reset the round-robin cursor. */
export function resetChainCursor(): void {
  cursor = 0;
}
