import { useQuery } from '@tanstack/react-query';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { NFTHIVE_CONFIG, CHEESE_CONFIG } from '@/lib/waxConfig';

const HYPERION_ENDPOINTS = [
  'https://wax.eosusa.io',
  'https://wax.eosphere.io',
  'https://api.wax.alohaeos.com',
  'https://wax.greymass.com',
];

export interface DropPurchase {
  timestamp: string;
  buyer: string;
  dropId: number;
  amount: number;
  quantity: string;
  currency: string;
  txId: string;
}

/** Fetch all drop IDs belonging to the official collection from the on-chain drops table */
async function fetchOfficialDropIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  let more = true;
  let lowerBound = '';

  while (more) {
    const response = await fetchTableRows<{
      drop_id: number;
      collection_name: string;
    }>({
      code: NFTHIVE_CONFIG.dropContract,
      scope: NFTHIVE_CONFIG.dropContract,
      table: 'drops',
      limit: 100,
      ...(lowerBound ? { lower_bound: lowerBound } : {}),
    });

    for (const row of response.rows) {
      if (row.collection_name === CHEESE_CONFIG.collectionName) {
        ids.add(row.drop_id);
      }
    }

    more = response.more;
    if (more && response.next_key) {
      lowerBound = response.next_key;
    } else {
      more = false;
    }
  }

  return ids;
}

async function fetchDropPurchases(): Promise<DropPurchase[]> {
  for (const endpoint of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${endpoint}/v2/history/get_actions?account=nfthivedrops&act.name=claimdrop&limit=200&sort=desc`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      if (!data.actions || !Array.isArray(data.actions)) continue;

      const purchases: DropPurchase[] = [];

      for (const action of data.actions) {
        const act = action.act?.data;
        if (!act) continue;

        let quantity = '—';
        let currency = 'CHEESE';

        if (action['@transfer']) {
          quantity = action['@transfer'].amount?.toString() ?? '—';
          currency = action['@transfer'].symbol ?? 'CHEESE';
        }

        purchases.push({
          timestamp: action['@timestamp'] || action.timestamp || '',
          buyer: act.claimer || '—',
          dropId: act.drop_id ?? 0,
          amount: act.amount ?? 1,
          quantity,
          currency,
          txId: action.trx_id || '',
        });
      }

      return purchases;
    } catch (err) {
      console.warn(`Hyperion ${endpoint} failed for drop purchases:`, (err as Error).message);
    }
  }

  return [];
}

async function fetchDropTransfers(): Promise<Map<string, { quantity: string; currency: string }>> {
  for (const endpoint of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${endpoint}/v2/history/get_actions?account=nfthivedrops&act.name=transfer&filter=*:transfer&transfer.to=nfthivedrops&limit=200&sort=desc`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      if (!data.actions || !Array.isArray(data.actions)) continue;

      const transferMap = new Map<string, { quantity: string; currency: string }>();

      for (const action of data.actions) {
        const act = action.act?.data;
        if (!act || act.to !== 'nfthivedrops') continue;
        if (act.memo !== 'deposit') continue;

        const txId = action.trx_id || '';
        if (txId) {
          const parts = (act.quantity || '').split(' ');
          transferMap.set(`${txId}:${act.from}`, {
            quantity: act.quantity || '—',
            currency: parts[1] || '?',
          });
        }
      }

      return transferMap;
    } catch (err) {
      console.warn(`Hyperion ${endpoint} failed for transfers:`, (err as Error).message);
    }
  }

  return new Map();
}

async function fetchOfficialPurchases(): Promise<DropPurchase[]> {
  const [purchases, transferMap, officialIds] = await Promise.all([
    fetchDropPurchases(),
    fetchDropTransfers(),
    fetchOfficialDropIds(),
  ]);

  // Filter to official collection drops only, then enrich with payment data
  return purchases
    .filter(p => officialIds.has(p.dropId))
    .map(p => {
      const key = `${p.txId}:${p.buyer}`;
      const transfer = transferMap.get(key);
      if (transfer) {
        return { ...p, quantity: transfer.quantity, currency: transfer.currency };
      }
      return p;
    });
}

export function useDropPurchases(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-drop-purchases'],
    queryFn: fetchOfficialPurchases,
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}
