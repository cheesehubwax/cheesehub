// CHEESECrypt wallet NFT list (avatar and attach-NFT pickers) through the user's own v1.6+ Tor helper,
// so AtomicAssets never sees which wallet this IP is browsing. Images keep their raw IPFS reference;
// the grid turns them into helper URLs.
import type { UserNFT } from '@/hooks/useUserNFTs';

export const TOR_NFT_PAGE = 100;
export const TOR_NFT_MAX_PAGES = 20;
const ACCOUNT = /^[a-z1-5.]{1,13}$/;

type RawAsset = {
  asset_id: string; name?: string; template_mint?: string; transferred_at_time?: string;
  collection?: { collection_name?: string }; schema?: { schema_name?: string }; template?: { template_id?: string } | null;
  data?: Record<string, unknown>; immutable_data?: Record<string, unknown>;
};

export function mapTorAsset(a: RawAsset): UserNFT {
  const data = { ...(a.immutable_data ?? {}), ...(a.data ?? {}) } as Record<string, unknown>;
  const media = [data.img, data.image, data.video].find(v => typeof v === 'string' && v) as string | undefined;
  return {
    asset_id: String(a.asset_id),
    name: (typeof data.name === 'string' && data.name) || a.name || `NFT #${a.asset_id}`,
    image: media ?? '/placeholder.svg',
    collection: a.collection?.collection_name ?? '',
    schema: a.schema?.schema_name ?? '',
    template_id: a.template?.template_id ?? '',
    mint: a.template_mint || '1',
    transferred_at_time: a.transferred_at_time,
  };
}

export async function fetchTorWalletNfts(base: string, owner: string, fetcher: typeof fetch = fetch): Promise<UserNFT[]> {
  if (!ACCOUNT.test(owner)) throw new Error('Invalid account');
  const out: UserNFT[] = [];
  for (let page = 1; page <= TOR_NFT_MAX_PAGES; page++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 45_000);
    try {
      const res = await fetcher(`${base}/atomic/v1/assets?owner=${owner}&page=${page}&limit=${TOR_NFT_PAGE}&order=desc&sort=transferred`, { signal: ctl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`Tor helper HTTP ${res.status}`);
      const j = await res.json();
      if (!j?.success || !Array.isArray(j.data)) throw new Error('No NFT list in reply');
      out.push(...(j.data as RawAsset[]).map(mapTorAsset));
      if (j.data.length < TOR_NFT_PAGE) break;
    } finally { clearTimeout(t); }
  }
  return out;
}
