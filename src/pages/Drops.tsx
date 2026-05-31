import { Layout } from "@/components/Layout";
import { DropStatsBar } from "@/components/drops/DropStatsBar";

import { CreateDrop } from "@/components/drops/CreateDrop";
import { MyDrops } from "@/components/drops/MyDrops";
import { SimpleDropGrid } from "@/components/drops/VirtualizedDropGrid";
import { DropCard } from "@/components/drops/DropCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCheeseDropStats } from "@/services/atomicApi";
import { useDropsLoader } from "@/hooks/useDropsLoader";
import { useEnrichDrops } from "@/hooks/useEnrichDrops";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { NFTDrop } from "@/types/drop";
import { RefreshCw, Loader2 } from "lucide-react";
import { CHEESE_CONFIG } from "@/lib/waxConfig";
import { useMemo, useState } from "react";
import cheeseshoppe from "@/assets/cheeseshoppe.png";
import { playRandomFart } from "@/lib/fartSounds";

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

  // Official tab: only cheesenftwax collection, active drops
  const officialDrops = useMemo(() => {
    const now = Date.now();
    const getDropOrderValue = (drop: NFTDrop) => Number(drop.dropId ?? drop.id.replace(/^\D+/, ''));

    return displayDrops.filter(drop => {
      if (drop.collectionName !== CHEESE_CONFIG.collectionName) return false;
      const isSoldOut = drop.remaining <= 0 && drop.totalSupply > 0;
      const isEnded = drop.endDate ? new Date(drop.endDate).getTime() < now : false;
      const isNotStarted = drop.startDate ? new Date(drop.startDate).getTime() > now : false;
      return !isSoldOut && !isEnded && !isNotStarted;
    }).sort((a, b) => getDropOrderValue(a) - getDropOrderValue(b));
  }, [displayDrops]);


  // CHEESE tab: ALL drops priced in CHEESE (any collection), active drops
  const cheeseDrops = useMemo(() => {
    const now = Date.now();
    return displayDrops.filter(drop => {
      const isSoldOut = drop.remaining <= 0 && drop.totalSupply > 0;
      const isEnded = drop.endDate ? new Date(drop.endDate).getTime() < now : false;
      const isNotStarted = drop.startDate ? new Date(drop.startDate).getTime() > now : false;
      if (isSoldOut || isEnded || isNotStarted) return false;
      if (drop.collectionName === CHEESE_CONFIG.collectionName) return false;
      // Check if any price option is CHEESE
      const hasCheese = drop.currency === 'CHEESE' ||
        (drop.prices && drop.prices.some(p => p.currency === 'CHEESE'));
      return hasCheese;
    });
  }, [displayDrops]);

  const { enrichedDrops: enrichedOfficialDrops, loading: isEnrichingOfficial } = useEnrichDrops(officialDrops);
  const { enrichedDrops: enrichedCheeseDrops, loading: isEnrichingCheese } = useEnrichDrops(cheeseDrops);

  // Sub-category state for Official tab (cheesenftwax schemas)
  const [officialSubTab, setOfficialSubTab] = useState<'collectibles' | 'accountnames'>('collectibles');

  const accountNamesDrops = useMemo(
    () => enrichedOfficialDrops.filter(d => d.schemaName === 'accountnames'),
    [enrichedOfficialDrops]
  );
  const collectiblesDrops = useMemo(
    () => enrichedOfficialDrops.filter(d => d.schemaName !== 'accountnames'),
    [enrichedOfficialDrops]
  );
  const sortedCollectibles = useMemo(
    () => [...collectiblesDrops].sort((a, b) => Number(a.dropId ?? a.id.replace(/^\D+/, '')) - Number(b.dropId ?? b.id.replace(/^\D+/, ''))),
    [collectiblesDrops]
  );
  const classifyAccountDrop = (drop: NFTDrop): 'premium' | 'semi' => {
    const desc = (drop.description ?? '').toLowerCase().replace(/\s+/g, ' ');
    const isSemi = /semi[\s-]?premium/.test(desc);
    if (isSemi) return 'semi';
    if (/\bpremium\b/.test(desc)) return 'premium';
    return 'semi';
  };
  const sortByDropId = (a: NFTDrop, b: NFTDrop) =>
    Number(a.dropId ?? a.id.replace(/^\D+/, '')) - Number(b.dropId ?? b.id.replace(/^\D+/, ''));
  const premiumAccountDrops = useMemo(
    () => accountNamesDrops.filter(d => classifyAccountDrop(d) === 'premium').sort(sortByDropId).reverse(),
    [accountNamesDrops]
  );
  const semiPremiumAccountDrops = useMemo(
    () => accountNamesDrops.filter(d => classifyAccountDrop(d) !== 'premium').sort(sortByDropId),
    [accountNamesDrops]
  );

  const handleRefresh = async () => {
    await Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ['cheese-drop-stats'] }),
    ]);
  };

  const renderSkeletonGrid = () => (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <Layout>
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseshoppe} alt="CHEESEDrop" className="w-24 h-24 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">🛒</span>
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Drop</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <span className="text-2xl">🛒</span>
              </div>
              <p className="text-muted-foreground">Official and unofficial NFT Drops purchasable with $CHEESE tokens</p>
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12">
        <Tabs defaultValue="official" className="w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <TabsList className="bg-card/80 border border-border/50 h-10">
              <TabsTrigger value="official" className="gap-1.5 text-sm px-4">
                <span className="text-sm">⭐</span>
                <span className="hidden sm:inline">Official</span>
              </TabsTrigger>
              <TabsTrigger value="cheese" className="gap-1.5 text-sm px-4">
                <span className="text-sm">🧀</span>
                <span className="hidden sm:inline">CHEESE</span>
              </TabsTrigger>
              <TabsTrigger value="my-drops" className="gap-1.5 text-sm px-4">
                <span className="text-sm">📂</span>
                <span className="hidden sm:inline">My Drops</span>
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-1.5 text-sm px-4">
                <span className="text-sm">✍️</span>
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

          <TabsContent value="official">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold text-foreground">Official CHEESE Drops</h2>
              <p className="text-muted-foreground mt-2">Drops from the official cheesenftwax collection</p>
              {isEnrichingOfficial && enrichedOfficialDrops.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading images...</span>
                </div>
              )}
            </div>

            {isLoading && officialDrops.length === 0 ? renderSkeletonGrid() : officialDrops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No active official drops found.</p>
              </div>
            ) : (
              <Tabs value={officialSubTab} onValueChange={(v) => setOfficialSubTab(v as 'collectibles' | 'accountnames')} className="w-full">
                <div className="flex justify-center mb-6">
                  <TabsList className="bg-card/80 border border-border/50 h-9">
                    <TabsTrigger value="collectibles" className="gap-1.5 text-sm px-4">
                      <span className="text-sm">🖼️</span>
                      <span>Collectibles</span>
                      <span className="ml-1 rounded bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5 leading-none">
                        {sortedCollectibles.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="accountnames" className="gap-1.5 text-sm px-4">
                      <span className="text-sm">👤</span>
                      <span>Account Names</span>
                      <span className="ml-1 rounded bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5 leading-none">
                        {accountNamesDrops.length}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="collectibles">
                  {sortedCollectibles.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-lg text-muted-foreground">No active collectibles drops.</p>
                    </div>
                  ) : (
                    <SimpleDropGrid drops={sortedCollectibles} />
                  )}
                </TabsContent>

                <TabsContent value="accountnames">
                  {accountNamesDrops.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-lg text-muted-foreground">No account name drops available.</p>
                    </div>
                  ) : (
                    <div className="space-y-12">
                      <section>
                        <div className="mb-4 flex items-center gap-3">
                          <h3 className="font-display text-2xl font-bold text-foreground">Premium Accounts</h3>
                          <span className="rounded bg-primary/15 text-primary text-xs font-bold px-2 py-0.5 leading-none">
                            {premiumAccountDrops.length}
                          </span>
                        </div>
                        {premiumAccountDrops.length === 0 ? (
                          <p className="text-muted-foreground">No premium accounts available.</p>
                        ) : (
                          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
                            {premiumAccountDrops.map((drop) => (
                              <DropCard key={drop.id} drop={drop} alwaysGlow />
                            ))}
                          </div>
                        )}
                      </section>
                      <section>
                        <div className="mb-4 flex items-center gap-3">
                          <h3 className="font-display text-2xl font-bold text-foreground">Semi-Premium Accounts</h3>
                          <span className="rounded bg-primary/15 text-primary text-xs font-bold px-2 py-0.5 leading-none">
                            {semiPremiumAccountDrops.length}
                          </span>
                        </div>
                        {semiPremiumAccountDrops.length === 0 ? (
                          <p className="text-muted-foreground">No semi-premium accounts available.</p>
                        ) : (
                          <SimpleDropGrid drops={semiPremiumAccountDrops} />
                        )}
                      </section>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="cheese">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold text-foreground">$CHEESE Drops</h2>
              <p className="text-muted-foreground mt-2">All drops purchasable with $CHEESE token</p>
              {isEnrichingCheese && enrichedCheeseDrops.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading images...</span>
                </div>
              )}
            </div>

            {isLoading && cheeseDrops.length === 0 ? renderSkeletonGrid() : cheeseDrops.length === 0 ? (
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

      <div className="container pb-12 flex flex-col items-center gap-6">
        <DropStatsBar
          activeOfficialDrops={enrichedOfficialDrops.length}
          totalSold={cheeseStats?.totalSold ?? 0}
          cheeseNulled={cheeseStats?.cheeseNulled ?? 0}
          xCheeseValue={cheeseStats?.xCheeseValue ?? 0}
          isLoading={isLoading || isLoadingStats}
        />
        <p className="text-sm text-muted-foreground">
          Powered by the{" "}
          <a href="https://waxblock.io/account/nfthivedrops" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
            NFTHIVEDROPS
          </a>{" "}
          smart contract.
        </p>
      </div>
    </Layout>
  );
};

export default Drops;
