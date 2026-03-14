import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, Search, Layers, CheckSquare, Square, AlertTriangle,
  RefreshCw, Coins, Image as ImageIcon, Check,
} from "lucide-react";
import {
  FarmInfo, fetchUserStakes, fetchFarmStakableConfig,
  buildStakeNftsAction, buildUnstakeNftsAction, buildClaimRewardsAction,
  getCollectionNames, getIpfsUrl, UserStake, PendingReward, FarmStakableConfig,
  fetchUserGlobalStakes, GlobalStakeInfo,
} from "@/lib/farm";
import { ATOMIC_API } from "@/lib/waxConfig";
import { fetchWithFallback } from "@/lib/fetchWithFallback";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { batchGetOrFetch } from "@/lib/templateCache";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getTokenLogoUrl } from "@/lib/tokenLogos";
import { waxRpcCall } from "@/lib/waxRpcFallback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const TOKEN_LOGO_PLACEHOLDER = "/placeholder.svg";
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
];

interface NFTStakingProps {
  farm: FarmInfo;
  onRefresh: () => void;
}

interface NFTAsset {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}

// ── IPFS helpers ──

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("ipfs://")) return url.replace("ipfs://", "");
  const m = url.match(/\/ipfs\/([a-zA-Z0-9]+.*)/);
  if (m) return m[1];
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) return url;
  return null;
}

function getImageUrl(img: string | undefined): string {
  if (!img) return "/placeholder.svg";
  if (img.startsWith("http")) return img;
  if (img.startsWith("ipfs://")) return `${IPFS_GATEWAY}${img.replace("ipfs://", "")}`;
  if (img.startsWith("Qm") || img.startsWith("bafy") || img.startsWith("bafk"))
    return `${IPFS_GATEWAY}${img}`;
  return img || "/placeholder.svg";
}

function getMediaUrl(data: Record<string, string | undefined> | undefined): { url: string; isVideo: boolean } {
  if (!data) return { url: "/placeholder.svg", isVideo: false };
  const imageField = data.img || data.image;
  if (imageField) return { url: getImageUrl(imageField), isVideo: false };
  const videoField = data.video;
  if (videoField) return { url: getImageUrl(videoField), isVideo: true };
  return { url: "/placeholder.svg", isVideo: false };
}

// ── NFT Card with IPFS gateway fallback ──

interface NFTCardProps {
  nft: NFTAsset;
  isSelected: boolean;
  onToggle: () => void;
  stakedInFarm?: string;
}

const NFTCard = React.memo(function NFTCard({ nft, isSelected, onToggle, stakedInFarm }: NFTCardProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const ipfsHash = extractIpfsHash(nft.image);
  const hasValidImage = Boolean(nft.image && nft.image !== "/placeholder.svg");
  const isStakedElsewhere = Boolean(stakedInFarm);

  const currentImageUrl = useMemo(() => {
    if (!nft.image || nft.image === "/placeholder.svg") return "/placeholder.svg";
    if (ipfsHash) {
      const baseUrl = `${IPFS_GATEWAYS[gatewayIndex]}${ipfsHash}`;
      return retryCount > 0 ? `${baseUrl}?retry=${retryCount}` : baseUrl;
    }
    const sep = nft.image.includes("?") ? "&" : "?";
    return retryCount > 0 ? `${nft.image}${sep}retry=${retryCount}` : nft.image;
  }, [nft.image, ipfsHash, gatewayIndex, retryCount]);

  const handleImageError = useCallback(() => {
    if (ipfsHash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      setGatewayIndex((p) => p + 1);
      setImgLoaded(false);
    } else {
      setImgError(true);
    }
  }, [ipfsHash, gatewayIndex]);

  // Timeout fallback - try next gateway after 10s
  useEffect(() => {
    if (!hasValidImage || imgError || imgLoaded) return;
    const t = setTimeout(() => {
      if (!imgLoaded && !imgError) handleImageError();
    }, 10000);
    return () => clearTimeout(t);
  }, [hasValidImage, imgError, imgLoaded, currentImageUrl, handleImageError]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setImgLoaded(false);
    setGatewayIndex(0);
    setRetryCount((p) => p + 1);
  };

  const showErrorState = !hasValidImage || imgError;

  const card = (
    <button
      onClick={isStakedElsewhere ? undefined : onToggle}
      disabled={isStakedElsewhere}
      className={cn(
        "group relative rounded-md overflow-hidden border-2 transition-all aspect-square",
        isStakedElsewhere && "opacity-50 cursor-not-allowed grayscale-[30%]",
        isSelected
          ? "border-primary ring-1 ring-primary"
          : isStakedElsewhere
          ? "border-amber-500/50"
          : "border-transparent hover:border-muted-foreground/30"
      )}
    >
      {isStakedElsewhere && (
        <div className="absolute top-1 left-1 z-10">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        </div>
      )}
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 rounded-full p-0.5 bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        {showErrorState ? (
          <button
            type="button"
            className="w-full h-full flex flex-col items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors z-20"
            onClick={handleRetry}
            title="Click to retry loading image"
          >
            <ImageIcon className="h-5 w-5 text-primary mb-1" />
            <span className="text-[9px] text-primary font-medium">Retry</span>
            <span className="text-[8px] text-muted-foreground mt-0.5">#{nft.asset_id}</span>
          </button>
        ) : (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            )}
            <img
              src={currentImageUrl}
              alt={nft.name}
              className={cn(
                "w-full h-full object-contain transition-opacity",
                imgLoaded ? "opacity-100" : "opacity-0"
              )}
              loading="lazy"
              onError={handleImageError}
              onLoad={(e) => {
                const t = e.target as HTMLImageElement;
                if (t.naturalWidth === 0) handleImageError();
                else setImgLoaded(true);
              }}
            />
          </>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 bg-background/90">
        <p className="text-[8px] font-medium truncate leading-tight">{nft.name}</p>
        {isStakedElsewhere ? (
          <a href={`/farm/${stakedInFarm}`} className="text-[7px] text-amber-500 truncate leading-tight block hover:underline" onClick={(e) => e.stopPropagation()}>in: {stakedInFarm}</a>
        ) : (
          <p className="text-[7px] text-muted-foreground truncate leading-tight">#{nft.asset_id}</p>
        )}
      </div>
    </button>
  );

  if (isStakedElsewhere) {
    return (
      <div className="flex flex-col">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{card}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px]">
              <p className="text-xs">
                <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500" />
                Already staked in <span className="font-semibold">{stakedInFarm}</span>.
                Unstake there first.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <a
          href={`/farm/${stakedInFarm}`}
          className="mt-1 text-[10px] text-amber-500 hover:text-amber-400 hover:underline truncate text-center"
          title={`Go to ${stakedInFarm}`}
        >
          Staked in: {stakedInFarm}
        </a>
      </div>
    );
  }
  return card;
});

// ── Virtualized Grid (defined outside main component to avoid re-creation) ──

interface VirtualGridProps {
  items: NFTAsset[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  parentRef: React.RefObject<HTMLDivElement>;
  type: "stake" | "unstake";
  globallyStakedMap?: Map<string, string>;
}

// Responsive: matches grid-cols-3 sm:grid-cols-4 md:grid-cols-6
function getGridCols(): number {
  if (typeof window === "undefined") return 6;
  if (window.innerWidth < 640) return 3;
  if (window.innerWidth < 768) return 4;
  return 6;
}

const GRID_ROW_HEIGHT = 120;

const VirtualGrid = React.memo(function VirtualGrid({
  items,
  selected,
  onToggle,
  parentRef,
  type,
  globallyStakedMap,
}: VirtualGridProps) {
  const [cols, setCols] = useState(getGridCols);

  useEffect(() => {
    const handleResize = () => setCols(getGridCols());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rowCount = Math.ceil(items.length / cols);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => GRID_ROW_HEIGHT,
    overscan: 3,
  });

  return (
    <div ref={parentRef} className="h-[420px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const start = vRow.index * cols;
          const rowItems = items.slice(start, start + cols);
          return (
            <div
              key={vRow.key}
              className="absolute top-0 left-0 w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 px-1"
              style={{
                height: `${vRow.size}px`,
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              {rowItems.map((nft) => (
                <NFTCard
                  key={nft.asset_id}
                  nft={nft}
                  isSelected={selected.has(nft.asset_id)}
                  onToggle={() => onToggle(nft.asset_id)}
                  stakedInFarm={type === "stake" ? globallyStakedMap?.get(nft.asset_id) : undefined}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── Main Component ──

export function NFTStaking({ farm, onRefresh }: NFTStakingProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedToStake, setSelectedToStake] = useState<Set<string>>(new Set());
  const [selectedToUnstake, setSelectedToUnstake] = useState<Set<string>>(new Set());
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const stakeParentRef = useRef<HTMLDivElement>(null);
  const unstakeParentRef = useRef<HTMLDivElement>(null);

  // ── Stakable config ──
  const { data: stakableConfig } = useQuery({
    queryKey: ["farmStakableConfig", farm.farm_name],
    queryFn: () => fetchFarmStakableConfig(farm.farm_name),
    staleTime: 60000,
  });

  // ── Global stakes (cross-farm conflict detection) ──
  const { data: globalStakes = [], refetch: refetchGlobalStakes } = useQuery({
    queryKey: ["userGlobalStakes", accountName],
    queryFn: () => fetchUserGlobalStakes(accountName!),
    enabled: !!accountName,
    staleTime: 30000,
  });

  const globallyStakedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const stake of globalStakes) {
      if (stake.farmName !== farm.farm_name) {
        for (const assetId of stake.assetIds) {
          map.set(assetId, stake.farmName);
        }
      }
    }
    return map;
  }, [globalStakes, farm.farm_name]);

  // ── Staked NFTs ──
  const { data: stakedNfts = [], isLoading: isLoadingStaked, refetch: refetchStaked } = useQuery({
    queryKey: ["userStakes", accountName, farm.farm_name],
    queryFn: () => fetchUserStakes(accountName!, farm.farm_name),
    enabled: !!accountName,
    staleTime: 30000,
  });

  // ── Live reward calculation ──
  const [liveRewards, setLiveRewards] = useState<PendingReward[]>([]);
  const [pendingNextPayout, setPendingNextPayout] = useState<PendingReward[]>([]);
  const [nextPayoutIn, setNextPayoutIn] = useState<number>(0);

  const stakerData = useMemo(() => {
    if (!stakedNfts.length) return null;
    const first = stakedNfts[0] as UserStake;
    return {
      claimableBalances: first.claimable_balances || [],
      ratesPerHour: first.rates_per_hour || [],
      lastStateChange: first.last_state_change || 0,
    };
  }, [stakedNfts]);

  useEffect(() => {
    if (!stakerData || !stakerData.claimableBalances.length) {
      setLiveRewards([]);
      setPendingNextPayout([]);
      setNextPayoutIn(0);
      return;
    }

    const calc = () => {
      const now = Math.floor(Date.now() / 1000);
      const interval = farm.payout_interval || 3600;
      const isExpired = farm.expiration > 1 && now > farm.expiration;
      const effectiveNow = isExpired ? farm.expiration : now;

      const userLast = stakerData.lastStateChange || effectiveNow;
      const elapsed = Math.max(0, effectiveNow - userLast);
      const periods = Math.floor(elapsed / interval);
      const claimableHours = (periods * interval) / 3600;

      if (isExpired) {
        setNextPayoutIn(0);
      } else {
        const inPeriod = elapsed % interval;
        setNextPayoutIn(interval - inPeriod);
      }

      const claimable = stakerData.claimableBalances.map((b) => {
        const [amtStr, symbol] = b.quantity.split(" ");
        const base = parseFloat(amtStr) || 0;
        const prec = amtStr.includes(".") ? amtStr.split(".")[1]?.length || 0 : 0;
        const rate = stakerData.ratesPerHour.find((r) => r.quantity.includes(symbol));
        const rateAmt = rate ? parseFloat(rate.quantity.split(" ")[0]) : 0;
        return { symbol, amount: base + rateAmt * claimableHours, precision: prec, contract: b.contract };
      });

      const pending = stakerData.ratesPerHour.map((r) => {
        const [amtStr, symbol] = r.quantity.split(" ");
        const rateAmt = parseFloat(amtStr) || 0;
        const prec = amtStr.includes(".") ? amtStr.split(".")[1]?.length || 0 : 0;
        const hrsPerPeriod = interval / 3600;
        return { symbol, amount: rateAmt * hrsPerPeriod, precision: prec, contract: r.contract };
      });

      setLiveRewards(claimable);
      setPendingNextPayout(pending);
    };

    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [stakerData, farm.payout_interval, farm.expiration]);

  const pendingRewards: PendingReward[] = useMemo(() => {
    if (liveRewards.length > 0) return liveRewards;
    if (!stakedNfts.length) return [];
    const cb = (stakedNfts[0] as UserStake).claimable_balances;
    if (!cb?.length) return [];
    return cb.map((b) => {
      const [amtStr, symbol] = b.quantity.split(" ");
      return {
        symbol,
        amount: parseFloat(amtStr) || 0,
        precision: amtStr.includes(".") ? amtStr.split(".")[1]?.length || 0 : 0,
      };
    });
  }, [stakedNfts, liveRewards]);

  const totalPending = pendingRewards.reduce((a, r) => a + r.amount, 0);
  const hasRewards = totalPending > 0;

  // ── Eligible NFTs (blockchain-first with AtomicAssets API + template cache fallback) ──
  const { data: eligibleNfts = [], isLoading: isLoadingEligible, refetch: refetchEligible } = useQuery({
    queryKey: ["eligibleNfts", accountName, farm.farm_name, stakableConfig, stakedNfts],
    queryFn: async () => {
      if (!accountName || !stakableConfig) return [];

      const stakedAssetIds = new Set(stakedNfts.map((s) => s.asset_id));

      // Build eligible sets from config
      const eligibleCollections = new Set<string>();
      stakableConfig.collections.forEach((c) => c.collection && eligibleCollections.add(c.collection));
      stakableConfig.schemas.forEach((s) => s.collection && eligibleCollections.add(s.collection));
      stakableConfig.templates.forEach((t) => t.collection && eligibleCollections.add(t.collection));
      const templateIds = new Set(stakableConfig.templates.map((t) => t.template_id).filter(Boolean));

      // STRATEGY 1: Blockchain-first – query user's on-chain assets
      const eligibleAssetIds: string[] = [];
      const assetMetadataMap = new Map<string, { collection: string; schema: string; template_id: number }>();

      try {
        let lowerBound = "";
        let hasMore = true;
        let iterations = 0;

        while (hasMore && iterations < 10) {
          const response = await waxRpcCall<{
            rows: Array<{ asset_id: string; collection_name: string; schema_name: string; template_id: number }>;
            more: boolean;
            next_key: string;
          }>("/v1/chain/get_table_rows", {
            json: true,
            code: "atomicassets",
            scope: accountName,
            table: "assets",
            limit: 1000,
            lower_bound: lowerBound || undefined,
          });

          if (response.rows?.length > 0) {
            for (const asset of response.rows) {
              const id = String(asset.asset_id);
              if (stakedAssetIds.has(id)) continue;

              let isEligible = false;
              if (eligibleCollections.has(asset.collection_name)) isEligible = true;
              if (stakableConfig.schemas.some((s) => s.collection === asset.collection_name && s.schema === asset.schema_name)) isEligible = true;
              if (templateIds.has(asset.template_id)) isEligible = true;

              if (isEligible) {
                eligibleAssetIds.push(id);
                assetMetadataMap.set(id, {
                  collection: asset.collection_name,
                  schema: asset.schema_name,
                  template_id: asset.template_id,
                });
              }
            }

            if (response.more && response.rows.length === 1000) {
              const last = response.rows[response.rows.length - 1];
              lowerBound = String(BigInt(last.asset_id) + 1n);
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
          iterations++;
        }

        console.log("[NFTStaking] Found", eligibleAssetIds.length, "eligible assets on-chain");
      } catch (err) {
        console.error("[NFTStaking] Blockchain query failed:", err);
      }

      if (eligibleAssetIds.length === 0) return [];

      // STRATEGY 2: Fetch metadata from AtomicAssets API (with multi-endpoint fallback)
      const assets: NFTAsset[] = [];
      const cacheBuster = `_ts=${Date.now()}`;
      const batchSize = 50;

      for (let i = 0; i < eligibleAssetIds.length; i += batchSize) {
        const batch = eligibleAssetIds.slice(i, i + batchSize);
        try {
          const path = `${ATOMIC_API.paths.assets}?ids=${batch.join(",")}&${cacheBuster}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
          const json = await response.json();

          if (json.success && json.data) {
            for (const asset of json.data) {
              const media = getMediaUrl(asset.data);
              assets.push({
                asset_id: asset.asset_id,
                name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
                image: media.url,
                collection: asset.collection?.collection_name || "",
                schema: asset.schema?.schema_name || "",
                template_id: asset.template?.template_id || "",
              });
            }
          }
        } catch (err) {
          console.error("[NFTStaking] Error fetching asset metadata:", err);
        }
      }

      // STRATEGY 3: Template cache fallback for unindexed assets
      const fetchedIds = new Set(assets.map((a) => a.asset_id));
      const missingIds = eligibleAssetIds.filter((id) => !fetchedIds.has(id));

      if (missingIds.length > 0) {
        console.log("[NFTStaking] Fetching template metadata for", missingIds.length, "unindexed assets");

        const templateGroups = new Map<number, string[]>();
        for (const id of missingIds) {
          const meta = assetMetadataMap.get(id);
          if (meta?.template_id) {
            const arr = templateGroups.get(meta.template_id) || [];
            arr.push(id);
            templateGroups.set(meta.template_id, arr);
          }
        }

        const templateRequests = Array.from(templateGroups.entries()).map(([tid, ids]) => ({
          templateId: String(tid),
          collectionName: assetMetadataMap.get(ids[0])?.collection || "",
        }));

        const templateDataMap = await batchGetOrFetch(templateRequests);

        for (const [tid, ids] of templateGroups) {
          const meta = assetMetadataMap.get(ids[0]);
          const key = `${meta?.collection}:${tid}`;
          const tpl = templateDataMap.get(key);

          for (const id of ids) {
            assets.push({
              asset_id: id,
              name: tpl?.name || `NFT #${id}`,
              image: tpl?.image || "/placeholder.svg",
              collection: meta?.collection || "Unknown",
              schema: meta?.schema || "",
              template_id: String(tid),
            });
          }
        }

        // Handle templateless assets
        for (const id of missingIds) {
          if (fetchedIds.has(id) || assets.some((a) => a.asset_id === id)) continue;
          const meta = assetMetadataMap.get(id);
          assets.push({
            asset_id: id,
            name: `NFT #${id}`,
            image: "",
            collection: meta?.collection || "Unknown",
            schema: meta?.schema || "",
            template_id: meta?.template_id ? String(meta.template_id) : "",
          });
        }
      }

      return assets;
    },
    enabled: !!accountName && !!stakableConfig,
    staleTime: 0,
    gcTime: 0,
  });

  // ── Staked NFT details (AtomicAssets API + blockchain RPC + template cache fallback) ──
  const { data: stakedNftDetails = [], isLoading: isLoadingStakedDetails, refetch: refetchStakedDetails } = useQuery({
    queryKey: ["stakedNftDetails", stakedNfts.map((s) => s.asset_id).join(","), accountName],
    queryFn: async () => {
      if (!stakedNfts.length || !accountName) return [];

      const stakedAssetIds = stakedNfts.map((s) => s.asset_id);
      const assets: NFTAsset[] = [];

      // Try AtomicAssets API first (with fallback)
      const params = new URLSearchParams({ ids: stakedAssetIds.join(","), limit: "100" });
      const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;

      try {
        const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
        const json = await response.json();

        if (json.success && json.data) {
          for (const asset of json.data) {
            const media = getMediaUrl(asset.data);
            assets.push({
              asset_id: asset.asset_id,
              name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
              image: media.url,
              collection: asset.collection?.collection_name || "",
              schema: asset.schema?.schema_name || "",
              template_id: asset.template?.template_id || "",
            });
          }
        }
      } catch (err) {
        console.error("Error fetching staked NFT details:", err);
      }

      // Fallback: fetch missing assets from blockchain RPC + template cache
      const fetchedIds = new Set(assets.map((a) => a.asset_id));
      const missingIds = stakedAssetIds.filter((id) => !fetchedIds.has(id));

      if (missingIds.length > 0) {
        console.log("[NFTStaking] Missing staked assets from API:", missingIds.length);

        const metaMap = new Map<string, { template_id: number; collection: string; schema: string }>();

        // Query user's on-chain assets for metadata
        try {
          const result = await waxRpcCall<{
            rows: Array<{ asset_id: string; collection_name: string; schema_name: string; template_id: number }>;
          }>("/v1/chain/get_table_rows", {
            json: true,
            code: "atomicassets",
            scope: accountName,
            table: "assets",
            limit: 1000,
          });

          if (result.rows?.length > 0) {
            for (const row of result.rows) {
              const id = String(row.asset_id);
              if (missingIds.includes(id)) {
                metaMap.set(id, {
                  template_id: row.template_id || 0,
                  collection: row.collection_name || "",
                  schema: row.schema_name || "",
                });
              }
            }
          }
        } catch {
          console.error("[NFTStaking] Blockchain RPC fallback failed for staked assets");
        }

        // Template cache batch fetch
        const templateGroups = new Map<number, string[]>();
        for (const id of missingIds) {
          const meta = metaMap.get(id);
          if (meta?.template_id && meta.template_id > 0) {
            const arr = templateGroups.get(meta.template_id) || [];
            arr.push(id);
            templateGroups.set(meta.template_id, arr);
          }
        }

        const templateRequests = Array.from(templateGroups.entries()).map(([tid, ids]) => ({
          templateId: String(tid),
          collectionName: metaMap.get(ids[0])?.collection || "",
        }));

        const templateDataMap = await batchGetOrFetch(templateRequests);

        for (const [tid, ids] of templateGroups) {
          const meta = metaMap.get(ids[0]);
          const key = `${meta?.collection}:${tid}`;
          const tpl = templateDataMap.get(key);
          for (const id of ids) {
            assets.push({
              asset_id: id,
              name: tpl?.name || `NFT #${id}`,
              image: tpl?.image || "/placeholder.svg",
              collection: meta?.collection || "Unknown",
              schema: meta?.schema || "",
              template_id: String(tid),
            });
          }
        }

        // Remaining assets without template data
        const processedIds = new Set(assets.map((a) => a.asset_id));
        for (const id of missingIds) {
          if (processedIds.has(id)) continue;
          const meta = metaMap.get(id);
          assets.push({
            asset_id: id,
            name: `NFT #${id}`,
            image: "",
            collection: meta?.collection || "Unknown",
            schema: meta?.schema || "",
            template_id: meta?.template_id ? String(meta.template_id) : "",
          });
        }
      }

      return assets;
    },
    enabled: stakedNfts.length > 0 && !!accountName,
    staleTime: 0,
    gcTime: 0,
  });

  // ── Filter by search ──
  const filteredEligible = useMemo(() => {
    if (!searchQuery.trim()) return eligibleNfts;
    const q = searchQuery.toLowerCase();
    return eligibleNfts.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.collection.toLowerCase().includes(q) ||
        n.asset_id.includes(q) ||
        n.template_id.includes(q)
    );
  }, [eligibleNfts, searchQuery]);

  const filteredStaked = useMemo(() => {
    if (!searchQuery.trim()) return stakedNftDetails;
    const q = searchQuery.toLowerCase();
    return stakedNftDetails.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.collection.toLowerCase().includes(q) ||
        n.asset_id.includes(q)
    );
  }, [stakedNftDetails, searchQuery]);

  // ── Bulk select ──
  const selectAllEligible = () => {
    const stakeable = filteredEligible.filter((n) => !globallyStakedMap.has(n.asset_id));
    if (selectedToStake.size === stakeable.length && stakeable.length > 0) {
      setSelectedToStake(new Set());
    } else {
      setSelectedToStake(new Set(stakeable.map((n) => n.asset_id)));
    }
  };

  const selectAllStaked = () => {
    if (selectedToUnstake.size === filteredStaked.length && filteredStaked.length > 0) {
      setSelectedToUnstake(new Set());
    } else {
      setSelectedToUnstake(new Set(filteredStaked.map((n) => n.asset_id)));
    }
  };

  const toggleStake = (id: string) => {
    if (globallyStakedMap.has(id)) return; // NFT staked elsewhere, not selectable
    setSelectedToStake((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleUnstake = (id: string) =>
    setSelectedToUnstake((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Actions ──
  const refetchAll = async () => {
    await new Promise((r) => setTimeout(r, 1000));
    await Promise.all([refetchStaked(), refetchEligible(), refetchStakedDetails(), refetchGlobalStakes()]);
  };

  const handleStake = async () => {
    if (!accountName || selectedToStake.size === 0) return;
    setIsStaking(true);
    try {
      const ids = Array.from(selectedToStake).filter((id) => !globallyStakedMap.has(id));
      if (ids.length === 0) return;
      const action = buildStakeNftsAction(accountName, farm.farm_name, ids);
      const result = await executeTransaction([action], {
        successTitle: "NFTs Staked! 🌱",
        successDescription: `Staked ${ids.length} NFT(s)`,
      });
      if (result.success) {
        setSelectedToStake(new Set());
        queryClient.invalidateQueries({ queryKey: ["farmDetail", farm.farm_name] });
        await refetchAll();
        onRefresh();
      }
    } catch (err) {
      console.error("Stake failed:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to stake NFTs";
      const isInsufficient = /needs\s+\d+.*but\s+has\s+\d+/i.test(errMsg);
      toast({
        title: "Staking Failed",
        description: isInsufficient
          ? "Not enough rewards in the pool to support this NFT's earning power."
          : errMsg,
        variant: "destructive",
      });
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!accountName || selectedToUnstake.size === 0) return;
    setIsUnstaking(true);
    try {
      const ids = Array.from(selectedToUnstake);
      const claimAction = buildClaimRewardsAction(accountName, farm.farm_name);
      const unstakeAction = buildUnstakeNftsAction(accountName, farm.farm_name, ids);
      const result = await executeTransaction([claimAction, unstakeAction], {
        successTitle: "NFTs Unstaked!",
        successDescription: `Claimed rewards and unstaked ${ids.length} NFT(s)`,
      });
      if (result.success) {
        setSelectedToUnstake(new Set());
        queryClient.invalidateQueries({ queryKey: ["farmDetail", farm.farm_name] });
        await refetchAll();
        onRefresh();
      }
    } catch (err) {
      console.error("Unstake failed:", err);
      toast({
        title: "Unstaking Failed",
        description: err instanceof Error ? err.message : "Failed to unstake NFTs",
        variant: "destructive",
      });
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleClaim = async () => {
    if (!accountName) return;
    setIsClaiming(true);
    try {
      const action = buildClaimRewardsAction(accountName, farm.farm_name);
      const result = await executeTransaction([action], {
        successTitle: "Rewards Claimed! 💰",
        successDescription: `Successfully claimed from ${farm.farm_name}`,
      });
      if (result.success) {
        await refetchStaked();
        onRefresh();
      }
    } catch (err) {
      console.error("Claim failed:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to claim rewards";
      const isOverdrawn = errMsg.toLowerCase().includes("overdrawn");
      toast({
        title: isOverdrawn ? "Insufficient Reward Pool" : "Claim Failed",
        description: isOverdrawn
          ? "The reward pool doesn't have enough tokens. Ask the farm owner to deposit more."
          : errMsg,
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };



  const now = Math.floor(Date.now() / 1000);
  const isExpired = farm.expiration > 1 && now > farm.expiration;
  const isLoadingAny = isLoadingStaked || isLoadingEligible || isLoadingStakedDetails;

  if (isLoadingAny && !eligibleNfts.length && !stakedNftDetails.length) {
    return (
      <Card className="bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
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
          <CardTitle className="text-lg flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              NFT Staking
              {stakedNfts.length > 0 && (
                <Badge variant="outline" className="text-xs font-normal ml-1">
                  {stakedNfts.length} NFT{stakedNfts.length !== 1 ? "s" : ""} staked
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchAll()}
              disabled={isLoadingAny}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingAny ? "animate-spin" : ""}`} />
              {isLoadingAny ? "Refreshing..." : "Refresh"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, collection, or template ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs defaultValue="unstaked">
            <TabsList className="grid grid-cols-2 w-full max-w-xs">
              <TabsTrigger value="unstaked">Unstaked ({eligibleNfts.length})</TabsTrigger>
              <TabsTrigger value="staked">Staked ({stakedNfts.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="unstaked" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={selectAllEligible}>
                  {selectedToStake.size === filteredEligible.filter((n) => !globallyStakedMap.has(n.asset_id)).length &&
                  filteredEligible.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <Button
                  onClick={handleStake}
                  disabled={isStaking || selectedToStake.size === 0 || isExpired}
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  {isStaking && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Stake Selected ({selectedToStake.size})
                </Button>
              </div>

              {isLoadingEligible ? (
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : filteredEligible.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No eligible NFTs found in your wallet</p>
                </div>
              ) : (
                <VirtualGrid
                  items={filteredEligible}
                  selected={selectedToStake}
                  onToggle={toggleStake}
                  parentRef={stakeParentRef as React.RefObject<HTMLDivElement>}
                  type="stake"
                  globallyStakedMap={globallyStakedMap}
                />
              )}
            </TabsContent>

            <TabsContent value="staked" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={selectAllStaked}>
                  {selectedToUnstake.size === filteredStaked.length && filteredStaked.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <Button
                  onClick={handleUnstake}
                  disabled={isUnstaking || selectedToUnstake.size === 0}
                  size="sm"
                  variant="outline"
                >
                  {isUnstaking && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Unstake Selected ({selectedToUnstake.size})
                </Button>
              </div>

              {isLoadingStakedDetails ? (
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : filteredStaked.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">You have no NFTs staked in this farm</p>
                </div>
              ) : (
                <VirtualGrid
                  items={filteredStaked}
                  selected={selectedToUnstake}
                  onToggle={toggleUnstake}
                  parentRef={unstakeParentRef as React.RefObject<HTMLDivElement>}
                  type="unstake"
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Rewards Card */}
      {stakedNfts.length > 0 && (
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Coins className="h-5 w-5 text-primary" />
              Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isExpired && (
              <Alert className="mb-4 border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm text-destructive">
                  This farm has expired. Rewards are no longer accruing. Claim any remaining rewards.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                <p className="text-xs text-foreground mb-2 font-medium">
                  Pending
                  {nextPayoutIn > 0 && (
                    <span className="text-muted-foreground/70 ml-1">
                      (in {Math.floor(nextPayoutIn / 60)}:{(nextPayoutIn % 60).toString().padStart(2, "0")})
                    </span>
                  )}
                </p>
                {pendingNextPayout.length > 0 && pendingNextPayout.some((r) => r.amount > 0) ? (
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
                        <Badge variant="outline" className="text-foreground border-border/50 text-xs">
                          +{reward.amount.toFixed(reward.precision)} {reward.symbol}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground text-sm">—</p>
                )}
              </div>

              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                <p className="text-xs text-foreground mb-2 font-medium">Claimable Now</p>
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
                        <Badge variant="secondary" className="bg-primary/10 text-foreground border-primary/20">
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

            <div className="flex justify-center">
              <Button
                onClick={handleClaim}
                disabled={isClaiming || !hasRewards}
                className="w-full sm:w-1/2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isClaiming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Coins className="h-4 w-4 mr-2" />}
                Claim Rewards
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
