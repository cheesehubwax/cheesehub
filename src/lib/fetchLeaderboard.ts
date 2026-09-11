// Nullers Leaderboard - fetches logburn actions from Hyperion and aggregates stats.
//
// Coverage note: individual Hyperion providers can silently lose or partially
// re-index a contract's history (observed: one provider returning 26 of 190
// logburn actions). A single-endpoint read therefore produces a leaderboard that
// looks "suddenly wrong". We query several providers, merge their results by
// unique action identity and keep the most complete union.

const HYPERION_ENDPOINTS = [
  'https://wax.cryptolions.io',
  'https://api.waxsweden.org',
  'https://wax.eosusa.io',
  'https://wax.eosphere.io',
  'https://wax.blokcrafters.io',
];
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 10000; // safety cap
const ENDPOINT_TIMEOUT_MS = 20000;

export interface LogburnAction {
  /** Stable identity: `${trx_id}:${action_ordinal}` — used to de-duplicate across providers. */
  id: string;
  caller: string;
  cheese_burned: string;
  wax_claimed: string;
  wax_swapped: string;
}

export interface NullerStats {
  rank: number;
  account: string;
  burns: number;
  cheeseNulled: number;
}

export type SortMode = 'cheese' | 'burns';

interface HyperionAction {
  trx_id?: string;
  action_ordinal?: number;
  global_sequence?: number;
  act: {
    data: {
      caller: string;
      cheese_burned: string;
      wax_claimed: string;
      wax_swapped: string;
    };
  };
}

interface HyperionResponse {
  actions: HyperionAction[];
  total?: { value: number };
}

function actionId(action: HyperionAction, fallbackIndex: number): string {
  if (action.global_sequence !== undefined) return `gs:${action.global_sequence}`;
  if (action.trx_id) return `${action.trx_id}:${action.action_ordinal ?? 0}`;
  return `idx:${fallbackIndex}`;
}

async function fetchJson(url: string): Promise<HyperionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENDPOINT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Hyperion API error: ${response.status}`);
    return (await response.json()) as HyperionResponse;
  } finally {
    clearTimeout(timer);
  }
}

/** Paginate a single provider and return its de-duplicated actions. */
async function fetchFromEndpoint(base: string): Promise<Map<string, LogburnAction>> {
  const found = new Map<string, LogburnAction>();
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    const url = `${base}/v2/history/get_actions?act.account=cheeseburner&act.name=logburn&limit=${BATCH_SIZE}&skip=${skip}`;
    const data = await fetchJson(url);
    const actions = data.actions;

    if (!actions || actions.length === 0) break;

    actions.forEach((action, i) => {
      const d = action.act?.data;
      if (!d?.caller) return;
      const id = actionId(action, skip + i);
      if (found.has(id)) return;
      found.set(id, {
        id,
        caller: d.caller,
        cheese_burned: d.cheese_burned || '0',
        wax_claimed: d.wax_claimed || '0',
        wax_swapped: d.wax_swapped || '0',
      });
    });

    if (actions.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }

  return found;
}

export interface LogburnFetchResult {
  actions: LogburnAction[];
  /** Providers that answered without throwing. */
  endpointsSucceeded: number;
  /** Largest single-provider coverage seen this run. */
  bestEndpointCount: number;
}

/**
 * Reads logburn history from every configured provider and returns the union.
 * A provider with a thin index can only ever add rows, never remove them.
 */
export async function fetchLogburnActionsDetailed(): Promise<LogburnFetchResult> {
  const merged = new Map<string, LogburnAction>();
  let endpointsSucceeded = 0;
  let bestEndpointCount = 0;

  const results = await Promise.allSettled(
    HYPERION_ENDPOINTS.map((base) => fetchFromEndpoint(base)),
  );

  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.warn(`Nuller leaderboard fetch failed for ${HYPERION_ENDPOINTS[i]}:`, result.reason);
      return;
    }
    endpointsSucceeded += 1;
    bestEndpointCount = Math.max(bestEndpointCount, result.value.size);
    for (const [id, action] of result.value) {
      if (!merged.has(id)) merged.set(id, action);
    }
  });

  if (endpointsSucceeded === 0) {
    throw new Error('All Hyperion providers failed for the nuller leaderboard');
  }

  return {
    actions: Array.from(merged.values()),
    endpointsSucceeded,
    bestEndpointCount,
  };
}

export async function fetchLogburnActions(): Promise<LogburnAction[]> {
  const { actions } = await fetchLogburnActionsDetailed();
  return actions;
}

// Parse asset string like "14.05677787 WAX" to number
function parseAsset(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

export function aggregateNullerStats(actions: LogburnAction[], sortBy: SortMode = 'cheese'): NullerStats[] {
  const map = new Map<string, { burns: number; cheeseNulled: number }>();

  for (const action of actions) {
    const existing = map.get(action.caller) || { burns: 0, cheeseNulled: 0 };
    existing.burns += 1;
    existing.cheeseNulled += parseAsset(action.cheese_burned);
    map.set(action.caller, existing);
  }

  const entries = Array.from(map.entries()).map(([account, stats]) => ({
    rank: 0,
    account,
    ...stats,
  }));

  return sortNullers(entries, sortBy);
}

export function sortNullers(entries: NullerStats[], sortBy: SortMode): NullerStats[] {
  const sortFn = sortBy === 'burns'
    ? (a: NullerStats, b: NullerStats) => b.burns - a.burns
    : (a: NullerStats, b: NullerStats) => b.cheeseNulled - a.cheeseNulled;

  const sorted = [...entries].sort(sortFn).slice(0, 10);
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}
