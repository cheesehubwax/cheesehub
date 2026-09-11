// Shared, resilience-first Hyperion history reader.
//
// Why this exists: individual Hyperion providers can silently return a partial
// index for a contract (observed: one provider reporting 3 of 52 null transfers,
// another 0 of 7). They answer HTTP 200 and look fresh, so there is no way to
// tell a complete answer from a truncated one. The only safe read is the UNION
// of several providers, de-duplicated by on-chain action identity: a thin
// provider can then only ever add rows, never remove them.

export const DEFAULT_HYPERION_ENDPOINTS = [
  'https://wax.cryptolions.io',
  'https://wax.hivebp.io',
  'https://wax.eosphere.io',
];

export interface HyperionActionRecord {
  trx_id?: string;
  action_ordinal?: number;
  global_sequence?: number;
  '@timestamp'?: string;
  timestamp?: string;
  act?: {
    account?: string;
    name?: string;
    data?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface ActionsUnion {
  actions: HyperionActionRecord[];
  /** Providers that answered without throwing. */
  endpointsSucceeded: number;
  /** Providers we asked. */
  endpointsAttempted: number;
  /** Largest single-provider coverage seen this run. */
  bestEndpointCount: number;
}

export interface ActionsUnionOptions {
  endpoints?: string[];
  /** Rows per request. */
  batchSize?: number;
  /** Hard safety cap on rows read per provider. */
  maxActions?: number;
  timeoutMs?: number;
  /** Set false for "latest N" style reads that must not paginate. */
  paginate?: boolean;
}

/** Stable cross-provider identity for a single action. */
export function actionIdentity(action: HyperionActionRecord, fallbackIndex: number): string {
  if (action.global_sequence !== undefined && action.global_sequence !== null) {
    return `gs:${action.global_sequence}`;
  }
  if (action.trx_id) return `${action.trx_id}:${action.action_ordinal ?? 0}`;
  return `idx:${fallbackIndex}`;
}

async function fetchJson(url: string, timeoutMs: number): Promise<{ actions?: HyperionActionRecord[] }> {
  if (timeoutMs <= 0) throw new Error('Hyperion provider deadline exceeded');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Hyperion API error: ${response.status}`);
    return (await response.json()) as { actions?: HyperionActionRecord[] };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromEndpoint(
  base: string,
  query: string,
  batchSize: number,
  maxActions: number,
  timeoutMs: number,
  paginate: boolean,
): Promise<Map<string, HyperionActionRecord>> {
  const found = new Map<string, HyperionActionRecord>();
  let skip = 0;
  const deadline = Date.now() + timeoutMs;

  const separator = query.startsWith('?') ? '' : '?';
  const baseUrl = `${base.replace(/\/$/, '')}/v2/history/get_actions${separator}${query}`;

  while (skip < maxActions) {
    const url = `${baseUrl}&limit=${batchSize}${paginate ? `&skip=${skip}` : ''}`;
    // The timeout is a budget for the whole provider, not for every page. A
    // slow mirror must not hold the UI open once healthy mirrors have replied.
    const data = await fetchJson(url, deadline - Date.now());
    const actions = data.actions;
    if (!actions || actions.length === 0) break;

    actions.forEach((action, i) => {
      const id = actionIdentity(action, skip + i);
      if (!found.has(id)) found.set(id, action);
    });

    if (!paginate || actions.length < batchSize) break;
    skip += batchSize;
  }

  return found;
}

/**
 * Reads an action history from every configured provider in parallel and
 * returns the de-duplicated union.
 *
 * `query` is the querystring for `/v2/history/get_actions` WITHOUT `limit`
 * or `skip` (those are managed here), e.g.
 * `act.account=cheeseburger&act.name=transfer&transfer.to=eosio.null`.
 */
export async function fetchActionsUnion(
  query: string,
  options: ActionsUnionOptions = {},
): Promise<ActionsUnion> {
  const {
    endpoints = DEFAULT_HYPERION_ENDPOINTS,
    batchSize = 1000,
    maxActions = 50000,
    timeoutMs = 20000,
    paginate = true,
  } = options;

  const merged = new Map<string, HyperionActionRecord>();
  let endpointsSucceeded = 0;
  let bestEndpointCount = 0;

  const results = await Promise.allSettled(
    endpoints.map((base) => fetchFromEndpoint(base, query, batchSize, maxActions, timeoutMs, paginate)),
  );

  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.warn(`Hyperion history read failed for ${endpoints[i]}:`, result.reason);
      return;
    }
    endpointsSucceeded += 1;
    bestEndpointCount = Math.max(bestEndpointCount, result.value.size);
    for (const [id, action] of result.value) {
      if (!merged.has(id)) merged.set(id, action);
    }
  });

  if (endpointsSucceeded === 0) {
    throw new Error('All Hyperion history providers failed');
  }

  return {
    actions: Array.from(merged.values()),
    endpointsSucceeded,
    endpointsAttempted: endpoints.length,
    bestEndpointCount,
  };
}

/** Sum an asset field (e.g. `quantity`) across a union of actions. */
export function sumAssetField(
  actions: HyperionActionRecord[],
  field = 'quantity',
  filter?: (data: Record<string, unknown>) => boolean,
): number {
  let total = 0;
  for (const action of actions) {
    const data = action.act?.data;
    if (!data) continue;
    if (filter && !filter(data)) continue;
    const raw = data[field];
    if (typeof raw !== 'string') continue;
    const value = parseFloat(raw.split(' ')[0]);
    if (Number.isFinite(value)) total += value;
  }
  return total;
}
