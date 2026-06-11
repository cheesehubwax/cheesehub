import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Loader2, Sprout, Clock, Users, Gift, RefreshCw,
  Copy, ExternalLink, Edit, Globe, MessageCircle, Twitter,
  Youtube, BookOpen, Layers, Download, Upload, Info, HandCoins
} from "lucide-react";
import {
  fetchFarmDetails, FarmInfo, FARM_TYPE_LABELS, FarmType,
  calculateEffectiveBalance
} from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useQuery } from "@tanstack/react-query";
import { TokenLogo } from "@/components/TokenLogo";
import { useToast } from "@/hooks/use-toast";
import { useIpfsImageSrc } from "@/hooks/useIpfsImageSrc";
import { useFarmClaimTotals } from "@/hooks/useFarmClaimTotals";
import { NFTStaking } from "./NFTStaking";
import { EditFarmProfile } from "./EditFarmProfile";
import { OpenFarmDialog } from "./OpenFarmDialog";
import { ExtendFarmDialog } from "./ExtendFarmDialog";
import { CloseFarmDialog } from "./CloseFarmDialog";
import { PermCloseFarmDialog } from "./PermCloseFarmDialog";
import { KickUsersDialog } from "./KickUsersDialog";
import { EmptyFarmDialog } from "./EmptyFarmDialog";
import { DepositRewardsDialog } from "./DepositRewardsDialog";
import { WithdrawRewardsDialog } from "./WithdrawRewardsDialog";
import { ManageStakableAssets } from "./ManageStakableAssets";
import { StakeableAssets } from "./StakeableAssets";
import { FarmStakersTable } from "./FarmStakersTable";

interface FarmDetailProps {
  farmName: string;
  onBack: () => void;
}

function getFarmTypeLabel(farmType: number): string {
  const types: Record<number, FarmType> = { 0: "collections", 1: "schemas", 2: "templates", 3: "attributes" };
  return FARM_TYPE_LABELS[types[farmType] || "collections"];
}

function getStatusInfo(farm: FarmInfo): { label: string; className: string } {
  const now = Math.floor(Date.now() / 1000);
  if (farm.status === 2) return { label: "Permanently Closed", className: "bg-destructive/20 text-destructive border-destructive/30" };
  if (farm.status === 0) return { label: "Under Construction", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  // status === 1 (active)
  if (farm.expiration > 0 && farm.expiration < now) return { label: "Expired", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
  return { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" };
}

function formatAmount(val: string | number): string {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter className="h-4 w-4" />,
  discord: <MessageCircle className="h-4 w-4" />,
  telegram: <MessageCircle className="h-4 w-4" />,
  website: <Globe className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  medium: <BookOpen className="h-4 w-4" />,
};

function CreatorInfoBox({ farm, isUnderConstruction, isPermClosed, isExpired, hasStakers }: {
  farm: FarmInfo; isUnderConstruction: boolean; isPermClosed: boolean; isExpired: boolean; hasStakers: boolean;
}) {
  if (isPermClosed) {
    return (
      <Card className="bg-destructive/5 border-destructive/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">
            <strong>Permanently Closed.</strong> Kick all remaining stakers, then use <strong>Empty Farm</strong> to retrieve any leftover reward tokens.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (isUnderConstruction && hasStakers) {
    return (
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-400">
            <strong>Farm Closed.</strong> Now kick all remaining stakers, update your stakeable assets and reward pools, then re-open the farm.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (isUnderConstruction && !hasStakers) {
    return (
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-400">
            <strong>Under Construction.</strong> Add stakeable assets, deposit reward tokens, then press <strong>Open Farm</strong> to start accepting stakers.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (isExpired) {
    return (
      <Card className="bg-orange-500/5 border-orange-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-400">
            <strong>Farm Expired.</strong> You have 2 choices:
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Close farm → kick stakers → update settings → re-open</li>
              <li>Perm close → kick stakers → empty farm (irreversible)</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }
  // Active, not expired
  return (
    <Card className="bg-green-500/5 border-green-500/20">
      <CardContent className="p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
        <p className="text-sm text-green-400">
          <strong>Farm Active.</strong> Extend your farm before it expires to keep rewards flowing. You can also deposit more rewards or withdraw excess tokens.
        </p>
      </CardContent>
    </Card>
  );
}

export function FarmDetail({ farmName, onBack }: FarmDetailProps) {
  const { accountName, isConnected, session } = useWax();
  const { totals: claimTotals } = useFarmClaimTotals(accountName);
  const { toast } = useToast();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [openFarmOpen, setOpenFarmOpen] = useState(false);
  const [extendFarmOpen, setExtendFarmOpen] = useState(false);
  const [closeFarmOpen, setCloseFarmOpen] = useState(false);
  const [permCloseOpen, setPermCloseOpen] = useState(false);
  const [kickOpen, setKickOpen] = useState(false);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [manageAssetsOpen, setManageAssetsOpen] = useState(false);

  const { data: farm, isLoading, refetch } = useQuery({
    queryKey: ["farm-detail", farmName],
    queryFn: () => fetchFarmDetails(farmName),
    staleTime: 30_000,
  });

  const logo = useIpfsImageSrc(farm?.logo);
  const cover = useIpfsImageSrc(farm?.profile?.cover_image);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="text-center py-16">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Farm not found</p>
        <Button variant="ghost" onClick={onBack} className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
      </div>
    );
  }

  const status = getStatusInfo(farm);
  const isCreator = accountName === farm.creator;
  const now = Math.floor(Date.now() / 1000);

  // Derived state flags matching cheesehub exactly
  const isUnderConstruction = farm.status === 0;
  const isPermClosed = farm.status === 2;
  const isExpired = !isUnderConstruction && !isPermClosed && farm.expiration > 0 && farm.expiration < now;
  const hasStakers = farm.staked_count > 0;

  const expirationDate = farm.expiration > 0 ? new Date(farm.expiration * 1000).toLocaleDateString() : "No expiry";
  const createdDate = farm.time_created > 0 ? new Date(farm.time_created * 1000).toLocaleDateString() : "Unknown";
  const hoursInterval = farm.payout_interval / 3600;
  const daysLeft = farm.expiration > 0 ? Math.max(0, Math.floor((farm.expiration - now) / 86400)) : null;

  const socials = farm.socials || {};
  const socialLinks = Object.entries(socials).filter(([, url]) => url && url.trim());

  const handleCopyName = () => {
    navigator.clipboard.writeText(farm.farm_name);
    toast({ title: "Copied!", description: `${farm.farm_name} copied to clipboard` });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Farms
      </Button>

      {/* Cover image */}
      {cover.src && (
        <div className="w-full rounded-xl overflow-hidden">
          <img src={cover.src} alt="Farm cover" onError={cover.onError} className="w-full h-auto max-h-[400px] object-contain bg-card/60" />
        </div>
      )}

      {/* Farm Header */}
      <Card className="bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="h-20 w-20 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {logo.src ? (
                <img src={logo.src} alt={farm.farm_name} onError={logo.onError} className="h-full w-full object-contain" />
              ) : (
                <Sprout className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-foreground">{farm.farm_name}</h2>
                <Badge variant="outline" className="text-xs">V2</Badge>
                <Badge className={`text-xs ${status.className}`}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>by {farm.creator}</span>
                <Button variant="ghost" size="sm" className="h-6 p-1" onClick={handleCopyName}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {farm.description && (
                <p className="text-sm text-muted-foreground mt-2">{farm.description}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {isCreator && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditProfileOpen(true)}>
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  {isUnderConstruction && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setManageAssetsOpen(true)}>
                        <Layers className="h-4 w-4 mr-1" /> Manage Assets
                      </Button>
                      <Button size="sm" onClick={() => setOpenFarmOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                        Open Farm
                      </Button>
                    </>
                  )}
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://waxdao.io/farm/${farm.farm_name}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creator contextual info box */}
      {isCreator && (
        <CreatorInfoBox
          farm={farm}
          isUnderConstruction={isUnderConstruction}
          isPermClosed={isPermClosed}
          isExpired={isExpired}
          hasStakers={hasStakers}
        />
      )}

      {/* Public sponsor hint on expired farms (non-creator viewers) */}
      {!isCreator && isExpired && !isPermClosed && (
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-orange-400">
              <strong>Farm Expired.</strong> If unstaking fails with a contract assertion, the reward pool may be empty.
              Anyone can deposit a small amount of the listed reward token to unblock claims and unstakes.
            </div>
            {isConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDepositOpen(true)}
                className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-400 shrink-0"
              >
                <HandCoins className="h-4 w-4 mr-1" /> Sponsor Rewards
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Social links */}
      {socialLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {socialLinks.map(([key, url]) => (
            <Button key={key} variant="outline" size="sm" asChild className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary">
              <a href={url!.startsWith("http") ? url! : `https://${url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                {SOCIAL_ICONS[key] || <Globe className="h-4 w-4" />}
                <span className="capitalize text-xs">{key}</span>
              </a>
            </Button>
          ))}
        </div>
      )}

      {/* Farm Information + Reward Pools side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Farm Information */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Farm Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge className={`text-xs ${status.className}`}>{status.label}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">{getFarmTypeLabel(farm.farm_type)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Creator</p>
                <p className="font-medium font-mono">{farm.creator}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{createdDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expiration</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{expirationDate}</p>
                  {isCreator && !isUnderConstruction && !isExpired && !isPermClosed && (
                    <Button size="sm" variant="outline" onClick={() => setExtendFarmOpen(true)} className="h-6 text-xs px-2">
                      Extend
                    </Button>
                  )}
                  {isCreator && isExpired && !isPermClosed && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setCloseFarmOpen(true)} className="h-6 text-xs px-2">
                        Close
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setPermCloseOpen(true)} className="h-6 text-xs px-2">
                        Perm Close
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isCreator && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border/30">
                {(isUnderConstruction || isPermClosed) && hasStakers && (
                  <Button size="sm" variant="outline" onClick={() => setKickOpen(true)}>
                    Kick Stakers
                  </Button>
                )}
                {isPermClosed && !hasStakers && (
                  <Button size="sm" variant="outline" onClick={() => setEmptyOpen(true)}>
                    Empty Farm
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reward Pools */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-foreground">Reward Pools</CardTitle>
            <div className="flex gap-2">
              {isConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDepositOpen(true)}
                  disabled={isUnderConstruction || isPermClosed}
                  title={
                    isUnderConstruction
                      ? "Farm is under construction — open it before depositing"
                      : isPermClosed
                        ? "Farm is permanently closed — deposits are not accepted"
                        : undefined
                  }
                >
                  {isCreator ? (
                    <><Download className="h-4 w-4 mr-1" /> + Deposit</>
                  ) : (
                    <><HandCoins className="h-4 w-4 mr-1" /> Sponsor Rewards</>
                  )}
                </Button>
              )}
              {isCreator && !isUnderConstruction && !isExpired && !isPermClosed && (
                <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
                  <Upload className="h-4 w-4 mr-1" /> Withdraw
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {farm.reward_pools.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reward pools configured</p>
            ) : (
              <div className="space-y-3">
                {farm.reward_pools.map((pool, i) => {
                  const effective = calculateEffectiveBalance(pool, farm.last_payout, now);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <TokenLogo contract={pool.contract} symbol={pool.symbol} size="md" />
                        <div>
                          <p className="font-semibold text-foreground">{pool.symbol}</p>
                          <p className="text-xs text-foreground/70 font-mono">{pool.contract}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
                          {pool.balance} {pool.symbol}
                        </Badge>
                        {pool.total_hourly_reward && (
                          <p className="text-xs text-foreground/70">
                            {pool.total_hourly_reward}/hr
                          </p>
                        )}
                        {effective.hoursRemaining !== null && (
                          <p className="text-xs text-foreground/70">
                            ~{Math.floor(effective.hoursRemaining / 24)}d remaining
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {(() => {
              const userClaimed = claimTotals[farm.farm_name];
              if (!isConnected || !userClaimed || userClaimed.length === 0) return null;
              return (
                <div className="mt-4 pt-4 border-t border-cheese/20">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    You've claimed (lifetime)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {userClaimed.map((c, i) => (
                      <div key={`${c.contract}:${c.symbol}:${i}`} className="flex items-center gap-1.5 text-sm">
                        <TokenLogo contract={c.contract} symbol={c.symbol} size="sm" />
                        <span className="font-mono text-cheese">
                          {formatAmount(c.amount)} {c.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Farm Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Farm Stats</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 sm:p-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{farm.staked_count}</p>
            <p className="text-xs text-muted-foreground">NFTs Staked</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-4 text-center">
            <Gift className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{farm.reward_pools.length}</p>
            <p className="text-xs text-muted-foreground">Reward Tokens</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{hoursInterval}h</p>
            <p className="text-xs text-muted-foreground">Payout Interval</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-4 text-center">
            <Layers className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{daysLeft !== null ? `${daysLeft}d` : "∞"}</p>
            <p className="text-xs text-muted-foreground">Days Left</p>
          </CardContent>
        </Card>
      </div>

      {/* Stakeable Assets */}
      <StakeableAssets farmName={farm.farm_name} farmType={farm.farm_type} />

      {/* Owner-only: who is currently staking in this farm */}
      {isCreator && <FarmStakersTable farmName={farm.farm_name} />}

      {/* NFT Staking - show when connected */}
      {isConnected && (
        <NFTStaking farm={farm} onRefresh={refetch} />
      )}

      {/* Deposit dialog - available to all connected users */}
      {isConnected && (
        <DepositRewardsDialog farm={farm} open={depositOpen} onOpenChange={setDepositOpen} onSuccess={refetch} isCreator={isCreator} />
      )}

      {/* Creator-only management dialogs */}
      {isCreator && (
        <>
          <EditFarmProfile farm={farm} open={editProfileOpen} onOpenChange={setEditProfileOpen} onSuccess={refetch} />
          <OpenFarmDialog farm={farm} open={openFarmOpen} onOpenChange={setOpenFarmOpen} onSuccess={refetch} />
          <ExtendFarmDialog farm={farm} open={extendFarmOpen} onOpenChange={setExtendFarmOpen} onSuccess={refetch} />
          <CloseFarmDialog farm={farm} open={closeFarmOpen} onOpenChange={setCloseFarmOpen} onSuccess={refetch} />
          <PermCloseFarmDialog farm={farm} open={permCloseOpen} onOpenChange={setPermCloseOpen} onSuccess={refetch} />
          <KickUsersDialog farm={farm} open={kickOpen} onOpenChange={setKickOpen} onSuccess={refetch} />
          <EmptyFarmDialog farm={farm} open={emptyOpen} onOpenChange={setEmptyOpen} onSuccess={refetch} />
          <WithdrawRewardsDialog farm={farm} open={withdrawOpen} onOpenChange={setWithdrawOpen} onSuccess={refetch} />
          <ManageStakableAssets farm={farm} open={manageAssetsOpen} onOpenChange={setManageAssetsOpen} onSuccess={refetch} />
        </>
      )}
    </div>
  );
}
