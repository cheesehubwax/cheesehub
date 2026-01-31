import { useState, useEffect, useCallback } from 'react';
import { fetchUserAssets } from '@/services/atomicApi';
import type { NFTDrop, DropAuthRequirement } from '@/types/drop';

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  matchingAssets?: string[];
}

export function useDropEligibility(
  drop: NFTDrop | null,
  account: string | undefined
) {
  const [eligibility, setEligibility] = useState<EligibilityResult>({
    isEligible: true,
  });
  const [loading, setLoading] = useState(false);

  const checkEligibility = useCallback(async () => {
    if (!drop || !drop.authRequired || !drop.authRequirements?.length) {
      setEligibility({ isEligible: true });
      return;
    }

    if (!account) {
      setEligibility({
        isEligible: false,
        reason: 'Connect wallet to check eligibility',
      });
      return;
    }

    setLoading(true);

    try {
      // Check each requirement
      for (const req of drop.authRequirements) {
        const assets = await fetchUserAssets(account, req.collectionName);

        let matchingAssets: string[] = [];

        if (req.type === 'collection') {
          // User needs any NFT from this collection
          matchingAssets = (assets as Array<{ asset_id: string }>).map(a => a.asset_id);
        } else if (req.type === 'schema' && req.schemaName) {
          // User needs NFT from specific schema
          matchingAssets = (assets as Array<{ asset_id: string; schema: { schema_name: string } }>)
            .filter(a => a.schema?.schema_name === req.schemaName)
            .map(a => a.asset_id);
        } else if (req.type === 'template' && req.templateId) {
          // User needs NFT from specific template
          matchingAssets = (assets as Array<{ asset_id: string; template: { template_id: string } | null }>)
            .filter(a => a.template?.template_id === String(req.templateId))
            .map(a => a.asset_id);
        }

        if (matchingAssets.length === 0) {
          setEligibility({
            isEligible: false,
            reason: `Requires NFT from ${req.collectionName}${req.schemaName ? ` (${req.schemaName})` : ''}`,
          });
          setLoading(false);
          return;
        }

        setEligibility({
          isEligible: true,
          matchingAssets,
        });
      }
    } catch (err) {
      console.error('Failed to check eligibility:', err);
      setEligibility({
        isEligible: false,
        reason: 'Failed to verify eligibility',
      });
    } finally {
      setLoading(false);
    }
  }, [drop, account]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  return { eligibility, loading, refetch: checkEligibility };
}
