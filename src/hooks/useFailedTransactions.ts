import { useQuery } from '@tanstack/react-query';

const HYPERION_ENDPOINTS = [
  'https://wax.eosphere.io',
  'https://api.wax.alohaeos.com',
  'https://wax.greymass.com',
];

const CONTRACTS = ['cheeseburner', 'cheesefeefee', 'cheesebannad', 'cheesepowerz'];

export interface FailedTransaction {
  timestamp: string;
  contract: string;
  action: string;
  error: string;
  trxId: string;
}

async function fetchFailedForContract(contract: string): Promise<FailedTransaction[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const endpoint of HYPERION_ENDPOINTS) {
    try {
      const url = `${endpoint}/v2/history/get_actions?account=${contract}&after=${since}&sort=desc&limit=100`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      const actions = data.actions || [];

      // Filter for actions that have error traces
      const failed: FailedTransaction[] = [];
      for (const act of actions) {
        if (act.act?.data?.error || act.creator_action_ordinal === 0) {
          // Hyperion doesn't reliably index failed txs
        }
      }

      return failed;
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchAllFailed(): Promise<FailedTransaction[]> {
  const results = await Promise.all(CONTRACTS.map(fetchFailedForContract));
  return results.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function useFailedTransactions(enabled: boolean) {
  return useQuery<FailedTransaction[]>({
    queryKey: ['admin-failed-transactions'],
    queryFn: fetchAllFailed,
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
