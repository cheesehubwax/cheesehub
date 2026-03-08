import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Sprout, Clock, Users, Gift } from "lucide-react";
import { fetchFarmDetails, FarmInfo, getIpfsUrl, buildStakeNftsAction, buildUnstakeNftsAction, buildClaimRewardsAction, UserStake } from "@/lib/farm";
import { fetchTableRows } from "@/lib/waxRpcFallback";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useUserNFTs } from "@/hooks/useUserNFTs";
import { useToast } from "@/hooks/use-toast";

interface FarmDetailProps {
  farmName: string;
  onBack: () => void;
}

export function FarmDetail({ farmName, onBack }: FarmDetailProps) {
  const { accountName, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [txLoading, setTxLoading] = useState(false);
  const { toast } = useToast();
  const [farm, setFarm] = useState<FarmInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [userStakes, setUserStakes] = useState<UserStake[]>([]);
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);
  const [selectedStaked, setSelectedStaked] = useState<string[]>([]);

  // Load farm details
  useEffect(() => {
    async function load() {
      setLoading(true);
      const farmData = await fetchFarmDetails(farmName);
      setFarm(farmData);

      if (accountName) {
        try {
          const stakeData = await fetchTableRows<UserStake>({
            code: "farms.waxdao",
            scope: farmName,
            table: "stakers",
            lower_bound: accountName,
            upper_bound: accountName,
            key_type: "name",
            index_position: 2,
            limit: 100,
          });
          setUserStakes(stakeData.rows || []);
        } catch {
          setUserStakes([]);
        }
      }
      setLoading(false);
    }
    load();
  }, [farmName, accountName]);

  const { nfts } = useUserNFTs(accountName || undefined);

  const handleStake = async () => {
    if (!accountName || selectedNFTs.length === 0) return;
    const action = buildStakeNftsAction(accountName, farmName, selectedNFTs);
    const result = await transact(action);
    if (result.success) {
      toast({ title: "NFTs Staked! 🌱", description: `Staked ${selectedNFTs.length} NFTs` });
      setSelectedNFTs([]);
    }
  };

  const handleUnstake = async () => {
    if (!accountName || selectedStaked.length === 0) return;
    const action = buildUnstakeNftsAction(accountName, farmName, selectedStaked);
    const result = await transact(action);
    if (result.success) {
      toast({ title: "NFTs Unstaked!", description: `Unstaked ${selectedStaked.length} NFTs` });
      setSelectedStaked([]);
    }
  };

  const handleClaim = async () => {
    if (!accountName) return;
    const action = buildClaimRewardsAction(accountName, farmName);
    const result = await transact(action);
    if (result.success) {
      toast({ title: "Rewards Claimed! 💰", description: "Your rewards have been claimed" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Farm not found</p>
        <Button variant="ghost" onClick={onBack} className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
      </div>
    );
  }

  const logoUrl = farm.logo ? getIpfsUrl(farm.logo) : "";
  const now = Math.floor(Date.now() / 1000);
  const isExpired = farm.expiration > 0 && farm.expiration < now;
  const expirationDate = farm.expiration > 0 ? new Date(farm.expiration * 1000).toLocaleDateString() : "N/A";

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Farms
      </Button>

      {/* Farm Header */}
      <Card className="bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="h-20 w-20 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={farm.farm_name} className="h-full w-full object-cover" />
              ) : (
                <Sprout className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-foreground">{farm.farm_name}</h2>
                {farm.is_active && !isExpired ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                ) : (
                  <Badge variant="secondary">{isExpired ? "Expired" : "Inactive"}</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{farm.description || `Created by ${farm.creator}`}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Staked</p>
                <p className="font-semibold">{farm.staked_count}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Rewards</p>
                <p className="font-semibold">{farm.reward_pools.map(p => p.symbol).join(", ") || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Expires</p>
                <p className="font-semibold">{expirationDate}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reward Pools</p>
              <div className="space-y-1">
                {farm.reward_pools.map((pool, i) => (
                  <p key={i} className="text-sm font-mono">{pool.total_funds || `${pool.balance} ${pool.symbol}`}</p>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staking Actions */}
      {isConnected && (
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Your Stakes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {userStakes.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  You have {userStakes.length} NFT(s) staked in this farm
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleClaim} disabled={txLoading} className="bg-primary text-primary-foreground">
                    Claim Rewards
                  </Button>
                  <Button variant="outline" onClick={handleUnstake} disabled={txLoading || selectedStaked.length === 0}>
                    Unstake Selected ({selectedStaked.length})
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">You have no NFTs staked in this farm</p>
            )}

            {nfts.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Your eligible NFTs ({nfts.length})</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                  {nfts.slice(0, 24).map(nft => (
                    <div
                      key={nft.assetId}
                      className={`relative rounded-lg border p-1 cursor-pointer transition-all ${
                        selectedNFTs.includes(nft.assetId)
                          ? "border-primary bg-primary/10"
                          : "border-border/50 hover:border-primary/30"
                      }`}
                      onClick={() =>
                        setSelectedNFTs(prev =>
                          prev.includes(nft.assetId)
                            ? prev.filter(id => id !== nft.assetId)
                            : [...prev, nft.assetId]
                        )
                      }
                    >
                      <img src={nft.image} alt={nft.name} className="w-full aspect-square object-cover rounded" />
                      <p className="text-[10px] text-center truncate mt-1">{nft.name}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={handleStake} disabled={txLoading || selectedNFTs.length === 0} className="mt-3 bg-primary text-primary-foreground">
                  Stake Selected ({selectedNFTs.length})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
