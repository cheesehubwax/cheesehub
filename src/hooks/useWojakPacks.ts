import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import {
  WOJAK_PACK_COLLECTION,
  WOJAK_PACK_SCHEMA,
} from '@/lib/wojakUnbox';

export interface WojakPack {
  assetId: string;
  name: string;
  image: string;
  mintNumber: number | null;
  templateId: string | null;
}

interface AtomicAsset {
  asset_id: string;
  template_mint?: string | null;
  template?: { template_id?: string | null } | null;
  name?: string;
  data?: Record<string, string>;
}

async function fetchWojakPacks(owner: string): Promise<WojakPack[]> {
  const params = new URLSearchParams({
    owner,
    collection_name: WOJAK_PACK_COLLECTION,
    schema_name: WOJAK_PACK_SCHEMA,
    page: '1',
    limit: '100',
    order: 'desc',
    sort: 'asset_id',
  });

  const response = await fetchWithFallback(
    ATOMIC_API.baseUrls,
    `${ATOMIC_API.paths.assets}?${params.toString()}`,
    undefined,
    10000
  );
  const json = await response.json();
  const rows: AtomicAsset[] = json?.data || [];

  return rows.map((row) => {
    const data = row.data || {};
    const img = data.img || data.image || '';
    const mint = row.template_mint ? parseInt(row.template_mint, 10) : NaN;
    return {
      assetId: row.asset_id,
      name: data.name || row.name || 'Waxy Wojak Pack',
      image: img,
      mintNumber: Number.isFinite(mint) ? mint : null,
      templateId: row.template?.template_id ?? null,
    };
  });
}

export function useWojakPacks(owner: string | null | undefined) {
  return useQuery({
    queryKey: ['wojak-packs', owner ?? null],
    queryFn: () => fetchWojakPacks(owner!),
    enabled: !!owner,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateWojakPacks() {
  const qc = useQueryClient();
  return (owner: string | null | undefined) => {
    qc.invalidateQueries({ queryKey: ['wojak-packs', owner ?? null] });
    // Also invalidate any cached hoodpunknfts NFT lists so the freshly minted
    // Wojak appears and the burned pack disappears in NFT viewers.
    qc.invalidateQueries({ queryKey: ['nfts', owner, WOJAK_PACK_COLLECTION] });
    qc.invalidateQueries({ queryKey: ['user-nfts', owner] });
  };
}