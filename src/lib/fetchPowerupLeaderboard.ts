// Coverage note: single Hyperion providers can return a partially indexed
// history, which silently shrinks the leaderboard. Query several and merge.
const HYPERION_ENDPOINTS = [
  'https://wax.cryptolions.io/v2/history/get_actions',
  'https://api.waxsweden.org/v2/history/get_actions',
  'https://wax.eosphere.io/v2/history/get_actions',
  'https://wax.eosusa.io/v2/history/get_actions',
  'https://wax.blokcrafters.io/v2/history/get_actions',
];
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 10000;
const ENDPOINT_TIMEOUT_MS = 20000;

export interface PowerupTransferAction {
  /** Stable identity used to de-duplicate across providers. */
  id: string;
  from: string;
  quantity: string;
}

export interface PowerupLeaderStats {
  rank: number;
  account: string;
  powerups: number;
  cheeseBurned: number;
}

export type PowerupSortMode = 'cheese' | 'powerups';

interface HyperionAction {
  trx_id?: string;
  action_ordinal?: number;
  global_sequence?: number;
  act: {
    data: {
      from: string;
      to: string;
      quantity: string;
      memo: string;
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

async function fetchFromEndpoint(endpoint: string): Promise<Map<string, PowerupTransferAction>> {
  const found = new Map<string, PowerupTransferAction>();
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    const url = `${endpoint}?act.account=cheeseburger&act.name=transfer&transfer.to=cheesepowerz&limit=${BATCH_SIZE}&skip=${skip}`;
    const data = await fetchJson(url);
    const actions = data.actions;

    if (!actions || actions.length === 0) break;

    actions.forEach((action, i) => {
      const d = action.act?.data;
      if (!(d?.from && d?.quantity && d?.to === 'cheesepowerz')) return;
      const id = actionId(action, skip + i);
      if (found.has(id)) return;
      found.set(id, { id, from: d.from, quantity: d.quantity });
    });

    if (actions.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }

  return found;
}

/** Union of every provider's view, de-duplicated by action identity. */
export async function fetchPowerupTransfers(): Promise<PowerupTransferAction[]> {
  const merged = new Map<string, PowerupTransferAction>();
  let succeeded = 0;

  const results = await Promise.allSettled(
    HYPERION_ENDPOINTS.map((endpoint) => fetchFromEndpoint(endpoint)),
  );

  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.error(`Powerup leaderboard fetch failed for ${HYPERION_ENDPOINTS[i]}:`, result.reason);
      return;
    }
    succeeded += 1;
    for (const [id, action] of result.value) {
      if (!merged.has(id)) merged.set(id, action);
    }
  });

  if (succeeded === 0) return [];
  return Array.from(merged.values());
}

function parseAsset(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

export function aggregatePowerupStats(actions: PowerupTransferAction[], sortBy: PowerupSortMode = 'cheese'): PowerupLeaderStats[] {
  const map = new Map<string, { powerups: number; cheeseBurned: number }>();

  for (const action of actions) {
    const existing = map.get(action.from) || { powerups: 0, cheeseBurned: 0 };
    existing.powerups += 1;
    existing.cheeseBurned += parseAsset(action.quantity);
    map.set(action.from, existing);
  }

  const entries = Array.from(map.entries()).map(([account, stats]) => ({
    rank: 0,
    account,
    ...stats,
  }));

  const sortFn = sortBy === 'powerups'
    ? (a: PowerupLeaderStats, b: PowerupLeaderStats) => b.powerups - a.powerups
    : (a: PowerupLeaderStats, b: PowerupLeaderStats) => b.cheeseBurned - a.cheeseBurned;

  const sorted = [...entries].sort(sortFn).slice(0, 10);
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}
