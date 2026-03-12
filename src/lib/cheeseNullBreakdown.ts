// Fetches per-contract null breakdown from Hyperion + on-chain stats

const HYPERION_ENDPOINT = 'https://wax.eosusa.io/v2/history/get_actions';
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 50000;

const WAX_RPC_ENDPOINTS = [
  'https://wax.eosusa.io/v1/chain/get_table_rows',
  'https://api.waxsweden.org/v1/chain/get_table_rows',
  'https://wax.greymass.com/v1/chain/get_table_rows',
];

export interface NullBreakdownEntry {
  contract: string;
  amount: number;
  percent: number;
  amount24h: number;
  percent24h: number;
  amount7d: number;
  percent7d: number;
}

function parseAsset(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

async function fetchContractNulledFromHyperion(account: string, after?: string): Promise<number> {
  let total = 0;
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    let url = `${HYPERION_ENDPOINT}?act.account=cheeseburger&act.name=transfer&transfer.from=${account}&transfer.to=eosio.null&limit=${BATCH_SIZE}&skip=${skip}`;
    if (after) url += `&after=${after}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Hyperion API error: ${response.status}`);

    const data = await response.json();
    const actions = data.actions;

    if (!actions || actions.length === 0) break;

    for (const action of actions) {
      const quantity = action.act?.data?.quantity;
      if (quantity) {
        total += parseAsset(quantity);
      }
    }

    if (actions.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }

  return total;
}

// cheesepowerz stores its own stats on-chain (authoritative)
async function fetchCheesepowerzNulled(): Promise<number> {
  for (const endpoint of WAX_RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'cheesepowerz',
          scope: 'cheesepowerz',
          table: 'stats',
          json: true,
          limit: 1,
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.rows && data.rows.length > 0) {
        return parseAsset(data.rows[0].total_cheese_received);
      }
      return 0;
    } catch {
      continue;
    }
  }
  // Fallback to Hyperion if all RPC fail
  return fetchContractNulledFromHyperion('cheesepowerz');
}

async function fetchContractNulled(account: string): Promise<number> {
  if (account === 'cheesepowerz') {
    return fetchCheesepowerzNulled();
  }
  return fetchContractNulledFromHyperion(account);
}

const NULL_CONTRACTS = ['cheeseburner', 'cheesefeefee', 'cheesepowerz', 'cheesebannad'] as const;

function getAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function fetchNullBreakdown(): Promise<NullBreakdownEntry[]> {
  const after24h = getAgo(1);
  const after7d = getAgo(7);

  const results = await Promise.all(
    NULL_CONTRACTS.map(async (contract) => ({
      contract,
      amount: await fetchContractNulled(contract),
      amount24h: await fetchContractNulledFromHyperion(contract, after24h),
      amount7d: await fetchContractNulledFromHyperion(contract, after7d),
    }))
  );

  const grandTotal = results.reduce((sum, r) => sum + r.amount, 0);
  const grandTotal24h = results.reduce((sum, r) => sum + r.amount24h, 0);
  const grandTotal7d = results.reduce((sum, r) => sum + r.amount7d, 0);

  return results.map((r) => ({
    ...r,
    percent: grandTotal > 0 ? (r.amount / grandTotal) * 100 : 0,
    percent24h: grandTotal24h > 0 ? (r.amount24h / grandTotal24h) * 100 : 0,
    percent7d: grandTotal7d > 0 ? (r.amount7d / grandTotal7d) * 100 : 0,
  }));
}
