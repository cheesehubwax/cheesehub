import { useQuery } from '@tanstack/react-query';

const HYPERION_ENDPOINTS = [
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

async function fetchDropPurchases(): Promise<DropPurchase[]> {
  // Fetch claimdrop actions from nfthivedrops via Hyperion
  for (const endpoint of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${endpoint}/v2/history/get_actions?account=nfthivedrops&act.name=claimdrop&limit=100&sort=desc`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      if (!data.actions || !Array.isArray(data.actions)) continue;

      const purchases: DropPurchase[] = [];

      for (const action of data.actions) {
        const act = action.act?.data;
        if (!act) continue;

        // Find the matching transfer in the same transaction traces
        let quantity = '—';
        let currency = 'CHEESE';

        // Check inline traces for the transfer amount
        if (action['@transfer']) {
          quantity = action['@transfer'].amount?.toString() ?? '—';
          currency = action['@transfer'].symbol ?? 'CHEESE';
        }

        // Also check traces array for transfer info
        if (action.traces) {
          for (const trace of action.traces) {
            if (trace.act?.name === 'transfer' && trace.act?.data?.to === 'nfthivedrops') {
              quantity = trace.act.data.quantity ?? '—';
              currency = trace.act.data.quantity?.split(' ')[1] ?? 'CHEESE';
              break;
            }
          }
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

// Fetch transfer actions TO nfthivedrops to get payment amounts
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

async function fetchDropPurchasesWithPayments(): Promise<DropPurchase[]> {
  const [purchases, transferMap] = await Promise.all([
    fetchDropPurchases(),
    fetchDropTransfers(),
  ]);

  // Enrich purchases with transfer data
  return purchases.map(p => {
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
    queryFn: fetchDropPurchasesWithPayments,
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}
