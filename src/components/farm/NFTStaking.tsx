import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, Search, Gift, Layers, CheckSquare, Square, AlertTriangle,
  RefreshCw, Coins,
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
import { getTokenLogoUrl } from "@/lib/tokenLogos";

const TOKEN_LOGO_PLACEHOLDER = "/placeholder.svg";

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
  const [isClaiming, setIsClaiming] = useState(false);

  const [stakedNFTs, setStakedNFTs] = useState<DisplayNFT[]>([]);
  const [rawStakes, setRawStakes] = useState<UserStake[]>([]);
  const [unstakedNFTs, setUnstakedNFTs] = useState<DisplayNFT[]>([]);
  const [selectedUnstaked, setSelectedUnstaked] = useState<Set<string>>(new Set());
  const [selectedStaked, setSelectedStaked] = useState<Set<string>>(new Set());
  const [globalStakes, setGlobalStakes] = useState<GlobalStakeInfo[]>([]);

  // Live reward state
  const [liveRewards, setLiveRewards] = useState<PendingReward[]>([]);
  const [pendingNextPayout, setPendingNextPayout] = useState<PendingReward[]>([]);
  const [nextPayoutIn, setNextPayoutIn] = useState<number>(0);

  const parentRef = useRef<HTMLDivElement>(null);

  // Extract staker data for live reward calculation
  const stakerData = useMemo(() => {
    if (!rawStakes.length) return null;
    const firstStake = rawStakes[0];
    return {
      claimableBalances: firstStake.claimable_balances || [],
      ratesPerHour: firstStake.rates_per_hour || [],
      lastStateChange: firstStake.last_state_change || 0,
    };
  }, [rawStakes]);

  // Dynamic reward calculation based on completed payout periods
  useEffect(() => {
    if (!stakerData || !stakerData.claimableBalances.length) {
      setLiveRewards([]);
      setPendingNextPayout([]);
      setNextPayoutIn(0);
      return;
    }

    const calculateLiveRewards = () => {
      const now = Math.floor(Date.now() / 1000);
      const payoutInterval = farm.payout_interval || 3600;

      // Cap at farm expiration
      const isExpired = farm.expiration > 1 && now > farm.expiration;
      const effectiveNow = isExpired ? farm.expiration : now;

      const userLastStateChange = stakerData.lastStateChange || effectiveNow;
      const timeSinceUserStateChange = Math.max(0, effectiveNow - userLastStateChange);
      const completedPeriods = Math.floor(timeSinceUserStateChange / payoutInterval);
      const claimableHours = (completedPeriods * payoutInterval) / 3600;

      if (isExpired) {
        setNextPayoutIn(0);
      } else {
        const elapsedInCurrentPeriod = timeSinceUserStateChange % payoutInterval;
        const secondsUntilNextPayout = payoutInterval - elapsedInCurrentPeriod;
        setNextPayoutIn(secondsUntilNextPayout);
      }

      // Calculate claimable rewards
      const claimable = stakerData.claimableBalances.map((balance) => {
        const balanceParts = balance.quantity.split(" ");
        const baseAmount = parseFloat(balanceParts[0]) || 0;
        const symbol = balanceParts[1] || "";
        const precision = balanceParts[0].includes(".") ? balanceParts[0].split(".")[1]?.length || 0 : 0;
        const contract = balance.contract || "";

        const rate = stakerData.ratesPerHour.find(r => r.quantity.includes(symbol));
        const rateAmount = rate ? parseFloat(rate.quantity.split(" ")[0]) : 0;
        const claimableAmount = baseAmount + (rateAmount * claimableHours);

        return { symbol, amount: claimableAmount, precision, contract };
      });

      // Calculate pending rewards (one full payout period worth)
      const pending = stakerData.ratesPerHour.map((rate) => {
        const rateParts = rate.quantity.split(" ");
        const rateAmount = parseFloat(rateParts[0]) || 0;
        const symbol = rateParts[1] || "";
        const precision = rateParts[0].includes(".") ? rateParts[0].split(".")[1]?.length || 0 : 0;
        const contract = rate.contract || "";
        const hoursPerPeriod = payoutInterval / 3600;
        const pendingAmount = rateAmount * hoursPerPeriod;

        return { symbol, amount: pendingAmount, precision, contract };
      });

      setLiveRewards(claimable);
      setPendingNextPayout(pending);
    };

    calculateLiveRewards();
    const interval = setInterval(calculateLiveRewards, 1000);
    return () => clearInterval(interval);
  }, [stakerData, farm.payout_interval, farm.expiration]);

  // Fallback to static rewards if live calculation not available
  const pendingRewards: PendingReward[] = useMemo(() => {
    if (liveRewards.length > 0) return liveRewards;
    if (!rawStakes.length) return [];

    const claimableBalances = rawStakes[0]?.claimable_balances;
    if (!claimableBalances || !Array.isArray(claimableBalances)) return [];

    return claimableBalances.map((b) => {
      const parts = b.quantity.split(" ");
      const amount = parseFloat(parts[0]) || 0;
      const symbol = parts[1] || "";
      const precision = parts[0].includes(".") ? parts[0].split(".")[1]?.length || 0 : 0;
      return { symbol, amount, precision };
    });
  }, [rawStakes, liveRewards]);

  const totalPendingRewards = pendingRewards.reduce((acc, r) => acc + r.amount, 0);
  const hasRewards = totalPendingRewards > 0;

  const loadData = useCallback(async () => {
    if (!accountName) return;
    setLoading(true);

    try {
      const [userStakes, config, globals] = await Promise.all([
        fetchUserStakes(accountName, farm.farm_name),
        fetchFarmStakableConfig(farm.farm_name),
        fetchUserGlobalStakes(accountName),
      ]);

      setRawStakes(userStakes);
      setGlobalStakes(globals);

      const stakedAssetIds = new Set(userStakes.map(s => s.asset_id));

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
            const stakedFarmMap = new Map<string, string>();
            for (const g of globals) {
              for (const id of g.assetIds) {
                if (!stakedAssetIds.has(id)) {
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
    if (selectedUnstaked.size === filteredUnstaked.filter(n => !n.stakedInOtherFarm).length && filteredUnstaked.length > 0) {
      setSelectedUnstaked(new Set());
    } else {
      setSelectedUnstaked(new Set(filteredUnstaked.filter(n => !n.stakedInOtherFarm).map(n => n.asset_id)));
    }
  };

  const selectAllStaked = () => {
    if (selectedStaked.size === filteredStaked.length && filteredStaked.length > 0) {
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
      // Claim rewards before unstaking (like the reference)
      const claimAction = buildClaimRewardsAction(accountName, farm.farm_name);
      const unstakeAction = buildUnstakeNftsAction(accountName, farm.farm_name, ids);
      const result = await executeTransaction([claimAction, unstakeAction], {
        successTitle: "NFTs Unstaked!",
        successDescription: `Claimed rewards and unstaked ${ids.length} NFT(s)`,
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
    setIsClaiming(true);
    try {
      const action = buildClaimRewardsAction(accountName, farm.farm_name);
      const result = await executeTransaction([action], {
        successTitle: "Rewards Claimed! 💰",
        successDescription: `Successfully claimed rewards from ${farm.farm_name}`,
      });
      if (result.success) {
        await loadData();
        onRefresh();
      }
    } catch (error) {
      console.error("Claim failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to claim rewards";
      const isOverdrawn = errorMsg.toLowerCase().includes("overdrawn");
      toast({
        title: isOverdrawn ? "Insufficient Reward Pool" : "Claim Failed",
        description: isOverdrawn
          ? "The reward pool does not have enough tokens to cover your claim. Please ask the farm owner to deposit more rewards."
          : errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
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
                      <div className="absolute top-0 left-0 right-0 bg-orange-500/80 text-[8px] text-foreground text-center px-1 rounded-t-md z-10">
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

  const now = Math.floor(Date.now() / 1000);
  const isExpired = farm.expiration > 1 && now > farm.expiration;

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
    <div className="space-y-6">
      {/* NFT Staking Card */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                NFT Staking
              </CardTitle>
              {stakedNFTs.length > 0 && (
                <Badge variant="outline" className="text-xs font-normal">
                  {stakedNFTs.length} NFT{stakedNFTs.length !== 1 ? 's' : ''} staked
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadData()}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
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
                  disabled={txLoading || selectedUnstaked.size === 0 || isExpired}
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

      {/* Rewards Card - shown when user has staked NFTs */}
      {stakedNFTs.length > 0 && (
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Expiration warning */}
            {isExpired && (
              <Alert className="mb-4 border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm text-destructive">
                  This farm has expired. Rewards are no longer accruing. Speak to the farm owner about opening it again and claim any remaining rewards.
                </AlertDescription>
              </Alert>
            )}

            {/* 2-column rewards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Pending */}
              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Pending
                  {nextPayoutIn > 0 && (
                    <span className="text-muted-foreground/70 ml-1">
                      (in {Math.floor(nextPayoutIn / 60)}:{(nextPayoutIn % 60).toString().padStart(2, '0')})
                    </span>
                  )}
                </p>
                {pendingNextPayout.length > 0 && pendingNextPayout.some(r => r.amount > 0) ? (
                  <div className="space-y-1.5">
                    {pendingNextPayout.map((reward, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <img
                          src={reward.contract ? getTokenLogoUrl(reward.contract, reward.symbol) : TOKEN_LOGO_PLACEHOLDER}
                          alt={reward.symbol}
                          className="w-4 h-4 rounded-full opacity-70"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = TOKEN_LOGO_PLACEHOLDER;
                          }}
                        />
                        <Badge variant="outline" className="text-muted-foreground border-border/50 text-xs">
                          +{reward.amount.toFixed(reward.precision)} {reward.symbol}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">—</p>
                )}
              </div>

              {/* Claimable Now */}
              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Claimable Now</p>
                {pendingRewards.length > 0 && hasRewards ? (
                  <div className="space-y-1.5">
                    {pendingRewards.map((reward, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <img
                          src={reward.contract ? getTokenLogoUrl(reward.contract, reward.symbol) : TOKEN_LOGO_PLACEHOLDER}
                          alt={reward.symbol}
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = TOKEN_LOGO_PLACEHOLDER;
                          }}
                        />
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                          {reward.amount.toFixed(reward.precision)} {reward.symbol}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No claimable rewards</p>
                )}
              </div>
            </div>

            {/* Claim button */}
            <div className="flex justify-center">
              <Button
                onClick={handleClaim}
                disabled={isClaiming || !hasRewards}
                className="w-full sm:w-1/2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isClaiming ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Coins className="h-4 w-4 mr-2" />
                )}
                Claim Rewards
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
