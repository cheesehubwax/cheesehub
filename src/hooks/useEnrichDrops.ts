import { useState, useEffect } from 'react';
import { fetchTemplateById } from '@/services/atomicApi';
import type { NFTDrop } from '@/types/drop';

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
          // Only enrich if we have a template ID and missing data
          if (!drop.templateId || (drop.description && drop.image !== '/placeholder.svg')) {
            return drop;
          }

          try {
            const template = await fetchTemplateById(drop.templateId, drop.collectionName);
            if (template && mounted) {
              return {
                ...drop,
                name: drop.name || template.name,
                image: drop.image !== '/placeholder.svg' ? drop.image : (template.image || drop.image),
              };
            }
          } catch (err) {
            console.warn(`Failed to enrich drop ${drop.id}:`, err);
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
