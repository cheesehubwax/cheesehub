import { Layout } from "@/components/Layout";
import { DropsHero } from "@/components/drops/DropsHero";

import { CreateDrop } from "@/components/drops/CreateDrop";
import { MyDrops } from "@/components/drops/MyDrops";
import { SimpleDropGrid } from "@/components/drops/VirtualizedDropGrid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCheeseDropStats } from "@/services/atomicApi";
import { useDropsLoader } from "@/hooks/useDropsLoader";
import { useEnrichDrops } from "@/hooks/useEnrichDrops";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { NFTDrop } from "@/types/drop";
import { Package, Plus, Sandwich, RefreshCw, Loader2, Clock } from "lucide-react";
import { CHEESE_CONFIG } from "@/lib/waxConfig";
import { useMemo } from "react";

const Drops = () => {
  const queryClient = useQueryClient();

  const { drops, isLoading, isRefreshing, error, refresh } = useDropsLoader();

  const { data: cheeseStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['cheese-drop-stats'],
    queryFn: fetchCheeseDropStats,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  const displayDrops: NFTDrop[] = drops || [];

  const cheeseDrops = useMemo(() => {
    const now = Date.now();
    return displayDrops.filter(drop => {
      if (drop.collectionName !== CHEESE_CONFIG.collectionName) return false;
      const isSoldOut = drop.remaining <= 0 && drop.totalSupply > 0;
      const isEnded = drop.endDate ? new Date(drop.endDate).getTime() < now : false;
      const isNotStarted = drop.startDate ? new Date(drop.startDate).getTime() > now : false;
      return !isSoldOut && !isEnded && !isNotStarted;
    });
  }, [displayDrops]);

  const pendingDrops = useMemo(() => {
    const now = Date.now();
    return displayDrops.filter(drop => {
      if (drop.collectionName !== CHEESE_CONFIG.collectionName) return false;
      const isNotStarted = drop.startDate ? new Date(drop.startDate).getTime() > now : false;
      const isEnded = drop.endDate ? new Date(drop.endDate).getTime() < now : false;
      return isNotStarted && !isEnded;
    });
  }, [displayDrops]);

  const { enrichedDrops: enrichedCheeseDrops, loading: isEnrichingCheese } = useEnrichDrops(cheeseDrops);
  const { enrichedDrops: enrichedPendingDrops, loading: isEnrichingPending } = useEnrichDrops(pendingDrops);

  const handleRefresh = async () => {
    await Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ['cheese-drop-stats'] }),
    ]);
  };

  return (
    <Layout>
      <DropsHero totalDrops={cheeseStats?.activeDrops ?? 0} totalSales={cheeseStats?.totalSold ?? 0} />

      <main className="container pb-20">
        <Tabs defaultValue="cheese" className="w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="cheese" className="flex items-center gap-2">
                <Sandwich className="h-4 w-4" />
                <span className="hidden sm:inline">CHEESE</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Pending</span>
              </TabsTrigger>
              <TabsTrigger value="my-drops" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">My Drops</span>
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="shrink-0"
              title="Refresh drops"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <TabsContent value="cheese">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold text-foreground">$CHEESE Drops</h2>
              <p className="text-muted-foreground mt-2">Drops purchasable with $CHEESE token</p>
              {isEnrichingCheese && enrichedCheeseDrops.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading images...</span>
                </div>
              )}
            </div>

            {isLoading && cheeseDrops.length === 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : cheeseDrops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No active $CHEESE drops found.</p>
              </div>
            ) : (
              <SimpleDropGrid drops={enrichedCheeseDrops} />
            )}
          </TabsContent>

          <TabsContent value="my-drops">
            <MyDrops />
          </TabsContent>

          <TabsContent value="create">
            <CreateDrop />
          </TabsContent>
        </Tabs>
      </main>

      <div className="container pb-12 text-center text-sm text-muted-foreground">
        <p>
          Powered by the{" "}
          <a href="https://wax.bloks.io/account/nfthivedrop" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
            NFTHIVEDROP
          </a>{" "}
          smart contract.
        </p>
      </div>

      
    </Layout>
  );
};

export default Drops;
