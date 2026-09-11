import { useQuery } from '@tanstack/react-query';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { NFTHIVE_CONFIG, CHEESE_CONFIG, ATOMIC_API } from '@/lib/waxConfig';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';

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
  imageUrl?: string;
}

/** Fetch all drop IDs belonging to the official collection, plus their first template ID */
async function fetchOfficialDropData(): Promise<{ ids: Set<number>; templateMap: Map<number, number> }> {
  const ids = new Set<number>();
  const templateMap = new Map<number, number>();
  let more = true;
  let lowerBound = '';

  while (more) {
    const response = await fetchTableRows<{
      drop_id: number;
      collection_name: string;
      assets_to_mint: Array<{ template_id: number }>;
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
        const firstTemplate = row.assets_to_mint?.[0]?.template_id;
        if (firstTemplate) {
          templateMap.set(row.drop_id, firstTemplate);
        }
      }
    }

    more = response.more;
    if (more && response.next_key) {
      lowerBound = response.next_key;
    } else {
      more = false;
    }
  }

  return { ids, templateMap };
}

/** Batch-fetch template images from AtomicAssets API */
async function fetchTemplateImages(templateIds: number[]): Promise<Map<number, string>> {
  const imageMap = new Map<number, string>();
  if (templateIds.length === 0) return imageMap;

  const unique = [...new Set(templateIds)];
  const idsParam = unique.join(',');

  try {
    const res = await fetch(
      `${ATOMIC_API.baseUrl}/atomicassets/v1/templates?ids=${idsParam}&limit=${unique.length}`
    );
    if (!res.ok) return imageMap;
    const data = await res.json();

    for (const t of data.data || []) {
      const img = t.immutable_data?.img || t.immutable_data?.image || t.immutable_data?.video || '';
      if (img) {
        const hash = extractIpfsHash(img);
        imageMap.set(Number(t.template_id), hash ? getIpfsUrl(hash) : img);
      }
    }
  } catch {
    console.warn('[DropPurchases] Failed to fetch template images');
  }

  return imageMap;
}

async function fetchDropPurchases(): Promise<DropPurchase[]> {
  const { actions } = await fetchActionsUnion(
    'account=nfthivedrops&act.name=claimdrop&sort=desc',
    { endpoints: HYPERION_ENDPOINTS, batchSize: 200, paginate: false, timeoutMs: 10000 },
  );

  const purchases: DropPurchase[] = [];

  for (const action of actions) {
    const act = action.act?.data as Record<string, unknown> | undefined;
    if (!act) continue;

    let quantity = '—';
    let currency = 'CHEESE';

    const transfer = action['@transfer'] as { amount?: number; symbol?: string } | undefined;
    if (transfer) {
      quantity = transfer.amount?.toString() ?? '—';
      currency = transfer.symbol ?? 'CHEESE';
    }

    const normalizedDropId = Number(act.drop_id);
    if (isNaN(normalizedDropId)) continue;

    purchases.push({
      timestamp: (action['@timestamp'] as string) || (action.timestamp as string) || '',
      buyer: (act.claimer as string) || '—',
      dropId: normalizedDropId,
      amount: Number(act.amount) || 1,
      quantity,
      currency,
      txId: action.trx_id || '',
    });
  }

  // Newest first — providers are merged, so ordering must be re-established.
  purchases.sort((a, b) => Date.parse(b.timestamp || '0') - Date.parse(a.timestamp || '0'));
  return purchases;
}

async function fetchDropTransfers(): Promise<Map<string, { quantity: string; currency: string }>> {
  const transferMap = new Map<string, { quantity: string; currency: string }>();

  const { actions } = await fetchActionsUnion(
    'account=nfthivedrops&act.name=transfer&filter=*:transfer&transfer.to=nfthivedrops&sort=desc',
    { endpoints: HYPERION_ENDPOINTS, batchSize: 200, paginate: false, timeoutMs: 10000 },
  );

  for (const action of actions) {
    const act = action.act?.data as Record<string, unknown> | undefined;
    if (!act || act.to !== 'nfthivedrops') continue;
    if (act.memo !== 'deposit') continue;

    const txId = action.trx_id || '';
    if (!txId) continue;
    const quantity = typeof act.quantity === 'string' ? act.quantity : '';
    const parts = quantity.split(' ');
    transferMap.set(`${txId}:${act.from}`, {
      quantity: quantity || '—',
      currency: parts[1] || '?',
    });
  }

  return transferMap;
}


async function fetchOfficialPurchases(): Promise<DropPurchase[]> {
  const [purchases, transferMap, dropData] = await Promise.all([
    fetchDropPurchases(),
    fetchDropTransfers(),
    fetchOfficialDropData(),
  ]);

  const { ids: officialIds, templateMap } = dropData;

  // Filter to official collection drops only, then enrich with payment data
  const filtered = purchases
    .filter(p => officialIds.has(p.dropId))
    .map(p => {
      const key = `${p.txId}:${p.buyer}`;
      const transfer = transferMap.get(key);
      if (transfer) {
        return { ...p, quantity: transfer.quantity, currency: transfer.currency };
      }
      return p;
    });

  // Fetch template images for the filtered purchases
  const neededTemplateIds = [...new Set(
    filtered.map(p => templateMap.get(p.dropId)).filter((t): t is number => !!t)
  )];
  const templateImages = await fetchTemplateImages(neededTemplateIds);

  // Attach image URLs
  const enriched = filtered.map(p => {
    const templateId = templateMap.get(p.dropId);
    const imageUrl = templateId ? templateImages.get(templateId) : undefined;
    return { ...p, imageUrl };
  });

  console.log(`[DropPurchases] ${purchases.length} total, ${filtered.length} official, ${neededTemplateIds.length} templates fetched`);
  return enriched;
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
