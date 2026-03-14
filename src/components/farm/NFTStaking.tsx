import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Search, Gift, Layers, CheckSquare, Square, AlertTriangle,
} from "lucide-react";
import {
  FarmInfo, fetchUserStakes, fetchFarmStakableConfig, fetchPendingRewards,
  buildStakeNftsAction, buildUnstakeNftsAction, buildClaimRewardsAction,
  getCollectionNames, getIpfsUrl, UserStake, PendingReward, FarmStakableConfig,
  fetchUserGlobalStakes, GlobalStakeInfo,
} from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { TokenLogo } from "@/components/TokenLogo";
import { batchGetOrFetch } from "@/lib/templateCache";
import { useVirtualizer } from "@tanstack/react-virtual";

interface NFTStakingProps {
  farm: FarmInfo;
  onRefresh: () => void;
}

interface DisplayNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  template_id?: string;
  isVideo?: boolean;
  stakedInOtherFarm?: string;
}

export function NFTStaking({ farm, onRefresh }: NFTStakingProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("unstaked");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);

  const [stakedNFTs, setStakedNFTs] = useState<DisplayNFT[]>([]);
  const [unstakedNFTs, setUnstakedNFTs] = useState<DisplayNFT[]>([]);
  const [selectedUnstaked, setSelectedUnstaked] = useState<Set<string>>(new Set());
  const [selectedStaked, setSelectedStaked] = useState<Set<string>>(new Set());
  const [pendingRewards, setPendingRewards] = useState<PendingReward[]>([]);
  const [globalStakes, setGlobalStakes] = useState<GlobalStakeInfo[]>([]);

  const parentRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (!accountName) return;
    setLoading(true);

    try {
      const [userStakes, config, rewards, globals] = await Promise.all([
        fetchUserStakes(accountName, farm.farm_name),
        fetchFarmStakableConfig(farm.farm_name),
        fetchPendingRewards(accountName, farm.farm_name),
        fetchUserGlobalStakes(accountName),
      ]);

      setPendingRewards(rewards);
      setGlobalStakes(globals);

      // Build staked NFTs list
      const stakedAssetIds = new Set(userStakes.map(s => s.asset_id));

      // Fetch template metadata for staked NFTs
      const templateRequests = userStakes
        .filter(s => s.asset_id)
        .map(s => ({
          templateId: s.asset_id,
          collectionName: farm.farm_name,
        }));

      const staked: DisplayNFT[] = userStakes.map(s => ({
        asset_id: s.asset_id,
        name: `NFT #${s.asset_id}`,
        image: "/placeholder.svg",
        collection: farm.farm_name,
        template_id: s.asset_id,
      }));
      setStakedNFTs(staked);

      // Fetch unstaked NFTs from user's wallet filtered by farm collections
      const collections = getCollectionNames(config);
      if (collections.length > 0) {
        try {
          const collectionQuery = collections.join(",");
          const response = await fetch(
            `https://wax.api.atomicassets.io/atomicassets/v1/assets?owner=${accountName}&collection_name=${collectionQuery}&limit=500&order=desc&sort=asset_id`
          );
          const data = await response.json();

          if (data.success && data.data) {
            // Check which assets are staked in other farms
            const globalStakedIds = new Set<string>();
            const stakedFarmMap = new Map<string, string>();
            for (const g of globals) {
              for (const id of g.assetIds) {
                if (!stakedAssetIds.has(id)) {
                  globalStakedIds.add(id);
                  stakedFarmMap.set(id, g.farmName);
                }
              }
            }

            const unstaked: DisplayNFT[] = data.data
              .filter((asset: any) => !stakedAssetIds.has(String(asset.asset_id)))
              .map((asset: any) => {
                const immData = asset.data || asset.immutable_data || {};
                const img = immData.img || immData.image || immData.video || "";
                const isVideo = !!(immData.video && !immData.img);

                return {
                  asset_id: String(asset.asset_id),
                  name: immData.name || asset.name || `#${asset.asset_id}`,
                  image: img.startsWith("Qm") || img.startsWith("bafy") ? getIpfsUrl(img) : (img || "/placeholder.svg"),
                  collection: asset.collection?.collection_name || "",
                  template_id: asset.template?.template_id ? String(asset.template.template_id) : undefined,
                  isVideo,
                  stakedInOtherFarm: stakedFarmMap.get(String(asset.asset_id)),
                };
              });

            setUnstakedNFTs(unstaked);
          }
        } catch (e) {
          console.error("Failed to fetch user NFTs:", e);
        }
      }
    } catch (error) {
      console.error("Error loading staking data:", error);
    } finally {
      setLoading(false);
    }
  }, [accountName, farm.farm_name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUnstaked = useMemo(() => {
    if (!search.trim()) return unstakedNFTs;
    const q = search.toLowerCase();
    return unstakedNFTs.filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.collection.toLowerCase().includes(q) ||
      n.asset_id.includes(q) ||
      (n.template_id && n.template_id.includes(q))
    );
  }, [unstakedNFTs, search]);

  const filteredStaked = useMemo(() => {
    if (!search.trim()) return stakedNFTs;
    const q = search.toLowerCase();
    return stakedNFTs.filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.asset_id.includes(q)
    );
  }, [stakedNFTs, search]);

  const toggleUnstaked = (id: string) => {
    setSelectedUnstaked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStaked = (id: string) => {
    setSelectedStaked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllUnstaked = () => {
    if (selectedUnstaked.size === filteredUnstaked.length) {
      setSelectedUnstaked(new Set());
    } else {
      setSelectedUnstaked(new Set(filteredUnstaked.filter(n => !n.stakedInOtherFarm).map(n => n.asset_id)));
    }
  };

  const selectAllStaked = () => {
    if (selectedStaked.size === filteredStaked.length) {
      setSelectedStaked(new Set());
    } else {
      setSelectedStaked(new Set(filteredStaked.map(n => n.asset_id)));
    }
  };

  const handleStake = async () => {
    if (!accountName || selectedUnstaked.size === 0) return;
    setTxLoading(true);
    try {
      const ids = Array.from(selectedUnstaked);
      const action = buildStakeNftsAction(accountName, farm.farm_name, ids);
      const result = await executeTransaction([action], {
        successTitle: "NFTs Staked! 🌱",
        successDescription: `Staked ${ids.length} NFT(s)`,
      });
      if (result.success) {
        setSelectedUnstaked(new Set());
        await loadData();
        onRefresh();
      }
    } finally {
      setTxLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!accountName || selectedStaked.size === 0) return;
    setTxLoading(true);
    try {
      const ids = Array.from(selectedStaked);
      const action = buildUnstakeNftsAction(accountName, farm.farm_name, ids);
      const result = await executeTransaction([action], {
        successTitle: "NFTs Unstaked!",
        successDescription: `Unstaked ${ids.length} NFT(s)`,
      });
      if (result.success) {
        setSelectedStaked(new Set());
        await loadData();
        onRefresh();
      }
    } finally {
      setTxLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!accountName) return;
    setTxLoading(true);
    try {
      const action = buildClaimRewardsAction(accountName, farm.farm_name);
      const result = await executeTransaction([action], {
        successTitle: "Rewards Claimed! 💰",
        successDescription: "Your rewards have been claimed",
      });
      if (result.success) {
        await loadData();
        onRefresh();
      }
    } finally {
      setTxLoading(false);
    }
  };

  const NFTGrid = ({ items, selected, onToggle }: { items: DisplayNFT[]; selected: Set<string>; onToggle: (id: string) => void }) => {
    const COLS = 6;
    const ROW_HEIGHT = 180;
    const rowCount = Math.ceil(items.length / COLS);

    const rowVirtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement: () => parentRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: 3,
    });

    return (
      <div ref={parentRef} className="h-[500px] overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const startIdx = virtualRow.index * COLS;
            const rowItems = items.slice(startIdx, startIdx + COLS);

            return (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 px-1"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {rowItems.map(nft => (
                  <div
                    key={nft.asset_id}
                    className={`relative rounded-lg border p-1.5 cursor-pointer transition-all ${
                      selected.has(nft.asset_id)
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : nft.stakedInOtherFarm
                        ? "border-orange-500/30 bg-orange-500/5 opacity-60"
                        : "border-border/50 hover:border-primary/30"
                    }`}
                    onClick={() => !nft.stakedInOtherFarm && onToggle(nft.asset_id)}
                  >
                    {nft.stakedInOtherFarm && (
                      <div className="absolute top-0 left-0 right-0 bg-orange-500/80 text-[8px] text-white text-center px-1 rounded-t-md z-10">
                        In {nft.stakedInOtherFarm}
                      </div>
                    )}
                    <div className="absolute top-1 right-1 z-10">
                      {selected.has(nft.asset_id) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>
                    {nft.isVideo ? (
                      <video src={nft.image} className="w-full aspect-square object-contain rounded bg-muted/30" muted autoPlay loop />
                    ) : (
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="w-full aspect-square object-contain rounded bg-muted/30"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                      />
                    )}
                    <p className="text-[10px] text-center truncate mt-1">{nft.name}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            NFT Staking
          </CardTitle>
          {pendingRewards.length > 0 && (
            <Button
              onClick={handleClaim}
              disabled={txLoading}
              size="sm"
              className="bg-primary text-primary-foreground"
            >
              <Gift className="h-4 w-4 mr-2" />
              Claim Rewards
              {pendingRewards.map((r, i) => (
                <Badge key={i} variant="secondary" className="ml-1.5 text-[10px]">
                  {r.amount.toFixed(Math.min(r.precision, 4))} {r.symbol}
                </Badge>
              ))}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, collection, or template ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="unstaked">
              Unstaked ({unstakedNFTs.length})
            </TabsTrigger>
            <TabsTrigger value="staked">
              Staked ({stakedNFTs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unstaked" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={selectAllUnstaked}>
                {selectedUnstaked.size === filteredUnstaked.filter(n => !n.stakedInOtherFarm).length && filteredUnstaked.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
              <Button
                onClick={handleStake}
                disabled={txLoading || selectedUnstaked.size === 0}
                size="sm"
                className="bg-primary text-primary-foreground"
              >
                {txLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Stake Selected ({selectedUnstaked.size})
              </Button>
            </div>

            {filteredUnstaked.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No eligible NFTs found in your wallet</p>
              </div>
            ) : (
              <NFTGrid items={filteredUnstaked} selected={selectedUnstaked} onToggle={toggleUnstaked} />
            )}
          </TabsContent>

          <TabsContent value="staked" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={selectAllStaked}>
                {selectedStaked.size === filteredStaked.length && filteredStaked.length > 0 ? "Deselect All" : "Select All"}
              </Button>
              <Button
                onClick={handleUnstake}
                disabled={txLoading || selectedStaked.size === 0}
                size="sm"
                variant="outline"
              >
                {txLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Unstake Selected ({selectedStaked.size})
              </Button>
            </div>

            {filteredStaked.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">You have no NFTs staked in this farm</p>
              </div>
            ) : (
              <NFTGrid items={filteredStaked} selected={selectedStaked} onToggle={toggleStaked} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
