import { useState, useEffect } from 'react';
import { fetchTemplateById, getImageUrl } from '@/services/atomicApi';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import type { NFTDrop } from '@/types/drop';

const ATOMIC_BASE_URLS = [
  'https://wax.api.atomicassets.io',
  'https://aa.dapplica.io',
  'https://wax-aa.eu.eosamsterdam.net',
];

async function fetchPremintImage(collectionName: string): Promise<string | null> {
  try {
    const path = `/atomicassets/v1/assets?owner=nfthivedrops&collection_name=${collectionName}&limit=1`;
    const resp = await fetchWithFallback(ATOMIC_BASE_URLS, path);
    const json = await resp.json();
    if (json.success && json.data?.length > 0) {
      const asset = json.data[0];
      const d = asset.data || {};
      const im = asset.immutable_data || {};
      const img = d.img || d.image || im.img || im.image;
      return img ? getImageUrl(img) : null;
    }
  } catch { /* ignore */ }
  return null;
}

export function useEnrichDrops(drops: NFTDrop[]) {
  const [enrichedDrops, setEnrichedDrops] = useState<NFTDrop[]>(drops);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (drops.length === 0) {
      setEnrichedDrops([]);
      return;
    }

    let mounted = true;

    async function enrichDrops() {
      setLoading(true);

      const enriched = await Promise.all(
        drops.map(async (drop) => {
          const needsImage = !drop.image || drop.image === '/placeholder.svg' || drop.image.includes('placeholder');

          // Template-based enrichment for mint-on-demand drops
          if (drop.templateId && needsImage) {
            try {
              const template = await fetchTemplateById(drop.templateId, drop.collectionName);
              if (template && mounted) {
                return {
                  ...drop,
                  name: drop.name || template.name,
                  image: template.image || drop.image,
                  schemaName: template.schemaName || drop.schemaName,
                };
              }
            } catch (err) {
              console.warn(`Failed to enrich drop ${drop.id}:`, err);
            }
          }

          // Premint drops: no templateId, fetch from deposited assets
          if (!drop.templateId && needsImage && drop.collectionName) {
            const img = await fetchPremintImage(drop.collectionName);
            if (img && mounted) {
              return { ...drop, image: img };
            }
          }

          return drop;
        })
      );

      if (mounted) {
        setEnrichedDrops(enriched);
        setLoading(false);
      }
    }

    enrichDrops();

    return () => {
      mounted = false;
    };
  }, [drops]);

  return { enrichedDrops, loading };
}
