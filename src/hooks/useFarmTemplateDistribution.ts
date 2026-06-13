import { useQuery } from "@tanstack/react-query";
import {
  TEMPLATE_FETCH_CONCURRENCY,
  fetchFarmTemplateCounts,
  fetchTemplateStats,
  mapWithConcurrency,
} from "@/lib/farmTemplateStats";
import type { StakableTemplate } from "@/lib/farm";

export interface TemplateDistributionRow {
  templateId: number;
  collection: string;
  name: string;
  image: string;
  issuedSupply: number;
  maxSupply: number; // 0 = uncapped
  stakedInFarm: number;
  issuedPct: number | null; // null when issuedSupply === 0
  maxPct: number | null;    // null when maxSupply === 0 (uncapped)
  countUnknown?: boolean;   // true when the accounts request failed
  error?: string;
}

export interface UseFarmTemplateDistributionResult {
  rows: TemplateDistributionRow[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Resolves per-template staked counts and supply for an owner-only panel.
 * `enabled` must be flipped to true after the user clicks "Compute".
 */
export function useFarmTemplateDistribution(
  farmName: string,
  templates: StakableTemplate[],
  enabled: boolean,
): UseFarmTemplateDistributionResult {
  const key = templates
    .map((t) => `${t.collection}:${t.template_id}`)
    .sort()
    .join(",");

  const query = useQuery({
    queryKey: ["farm-template-distribution", farmName, key],
    enabled: enabled && templates.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<TemplateDistributionRow[]> => {
      // Resolve per-collection template counts in one request per collection.
      let countsMap = new Map<string, number>();
      let countsFailed = false;
      try {
        countsMap = await fetchFarmTemplateCounts(
          templates.map((t) => t.collection),
        );
      } catch (err) {
        console.warn("[useFarmTemplateDistribution] accounts fetch failed:", err);
        countsFailed = true;
      }

      const rows = await mapWithConcurrency(
        templates,
        TEMPLATE_FETCH_CONCURRENCY,
        async (t): Promise<TemplateDistributionRow> => {
          const stakedInFarm = countsMap.get(`${t.collection}:${t.template_id}`) ?? 0;
          try {
            const stats = await fetchTemplateStats(t.collection, t.template_id);
            const issuedPct =
              stats.issuedSupply > 0 ? (stakedInFarm / stats.issuedSupply) * 100 : null;
            const maxPct =
              stats.maxSupply > 0 ? (stakedInFarm / stats.maxSupply) * 100 : null;
            return {
              templateId: t.template_id,
              collection: t.collection,
              name: stats.name,
              image: stats.image,
              issuedSupply: stats.issuedSupply,
              maxSupply: stats.maxSupply,
              stakedInFarm,
              issuedPct,
              maxPct,
              countUnknown: countsFailed,
            };
          } catch (err) {
            return {
              templateId: t.template_id,
              collection: t.collection,
              name: `Template #${t.template_id}`,
              image: "/placeholder.svg",
              issuedSupply: 0,
              maxSupply: 0,
              stakedInFarm,
              issuedPct: null,
              maxPct: null,
              countUnknown: countsFailed,
              error: (err as Error).message || "Failed to load",
            };
          }
        },
      );
      rows.sort((a, b) => (b.issuedPct ?? -1) - (a.issuedPct ?? -1));
      return rows;
    },
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => {
      query.refetch();
    },
  };
}