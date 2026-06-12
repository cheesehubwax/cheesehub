import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Users, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useFarmStakers, useStakerAssetMeta } from "@/hooks/useFarmStakers";
import type { StakerAssetMeta } from "@/lib/farmStakers";

interface FarmStakersTableProps {
  farmName: string;
}

const PREVIEW_LIMIT = 8;
// Row layout: wallet | staked count | NFT thumbnails | external link
const ROW_GRID = "grid-cols-[minmax(0,1.4fr)_72px_minmax(0,3fr)_40px]";
const ESTIMATED_ROW_HEIGHT = 88;     // collapsed row (≤ 8 thumbs in one line)
const EXPANDED_ROW_HEIGHT_HINT = 220; // initial guess; real height measured
const SCROLL_HEIGHT = 560;

function Thumb({ assetId, meta }: { assetId: string; meta?: StakerAssetMeta }) {
  const img = meta?.image && !meta.image.includes("placeholder") ? meta.image : null;
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <a
          href={`https://waxblock.io/asset/${assetId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-8 h-8 rounded bg-muted overflow-hidden shrink-0 hover:ring-2 hover:ring-cheese transition"
          aria-label={`Asset ${assetId}`}
        >
          {img ? (
            <img
              src={img}
              alt={meta?.name || `NFT ${assetId}`}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          ) : (
            <div className="w-full h-full" />
          )}
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-56 p-2">
        {img && (
          <img src={img} alt={meta?.name || assetId} className="w-full h-40 object-contain rounded mb-2 bg-muted" />
        )}
        <p className="text-sm font-medium truncate">{meta?.name || `Asset ${assetId}`}</p>
        <p className="text-xs text-muted-foreground font-mono">#{assetId}</p>
        {meta?.mint && (
          <p className="text-xs text-muted-foreground">Mint #{meta.mint}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

const StakerRow = ({
  user,
  assetIds,
  expanded,
  onToggleExpanded,
  measureRef,
}: {
  user: string;
  assetIds: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  measureRef: (node: HTMLDivElement | null) => void;
}) => {
  const [inView, setInView] = useState(false);
  const localRef = useRef<HTMLDivElement | null>(null);

  // Combined ref: feed both the virtualizer measurer and our IO target.
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      measureRef(node);
    },
    [measureRef]
  );

  // Reveal & fetch metadata only once the row scrolls near the viewport.
  useEffect(() => {
    if (inView || !localRef.current) return;
    const el = localRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  const visibleIds = expanded ? assetIds : assetIds.slice(0, PREVIEW_LIMIT);
  const overflow = assetIds.length - PREVIEW_LIMIT;

  // Fetch metadata only for the ids currently rendered, and only after the
  // row is visible. Expanding triggers a second (cached) fetch covering the
  // remaining ids.
  const { assets } = useStakerAssetMeta(visibleIds, inView);

  return (
    <div
      ref={setRefs}
      data-index-stable
      className={`grid ${ROW_GRID} gap-2 items-start p-2 border-b border-border/40 hover:bg-muted/30 transition-colors`}
    >
      <a
        href={`https://waxblock.io/account/${user}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-mono text-primary hover:underline truncate"
      >
        {user}
      </a>
      <div>
        <Badge variant="outline" className="font-mono">{assetIds.length}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleIds.map(id => (
          <Thumb key={id} assetId={id} meta={assets.get(id)} />
        ))}
        {!expanded && overflow > 0 && (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="h-8 px-2 rounded bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 inline-flex items-center gap-1"
          >
            +{overflow} <ChevronDown className="h-3 w-3" />
          </button>
        )}
        {expanded && overflow > 0 && (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="h-8 px-2 rounded bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 inline-flex items-center gap-1"
          >
            Collapse <ChevronUp className="h-3 w-3" />
          </button>
        )}
      </div>
      <a
        href={`https://waxblock.io/account/${user}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-xs text-muted-foreground hover:text-primary"
        aria-label={`Open ${user} on waxblock`}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
};

export function FarmStakersTable({ farmName }: FarmStakersTableProps) {
  const { stakers, isLoading, isFetching, error, refetch } = useFarmStakers(farmName, true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  const totalStaked = stakers.reduce((sum, s) => sum + s.assetIds.length, 0);

  const virtualizer = useVirtualizer({
    count: stakers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const s = stakers[index];
      if (!s) return ESTIMATED_ROW_HEIGHT;
      return expandedUsers.has(s.user) ? EXPANDED_ROW_HEIGHT_HINT : ESTIMATED_ROW_HEIGHT;
    },
    overscan: 4,
  });

  const toggleExpanded = useCallback((user: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(user)) next.delete(user); else next.add(user);
      return next;
    });
  }, []);

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-cheese" />
          Current Stakers
          {!isLoading && stakers.length > 0 && (
            <Badge variant="outline" className="ml-2 text-xs">
              {stakers.length} wallet{stakers.length === 1 ? "" : "s"} · {totalStaked} NFT{totalStaked === 1 ? "" : "s"}
            </Badge>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-4 text-center">
            Failed to load stakers.{" "}
            <button onClick={refetch} className="underline">Retry</button>
          </div>
        ) : stakers.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            No active stakers yet.
          </p>
        ) : (
          <div className="rounded-md border border-border/50 overflow-hidden">
            <div
              className={`grid ${ROW_GRID} gap-2 px-2 py-2 bg-muted/40 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider`}
            >
              <span>Wallet</span>
              <span>Staked</span>
              <span>NFTs</span>
              <span className="sr-only">Link</span>
            </div>
            <div
              ref={parentRef}
              className="overflow-auto"
              style={{ height: `${SCROLL_HEIGHT}px` }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map(vRow => {
                  const s = stakers[vRow.index];
                  if (!s) return null;
                  return (
                    <div
                      key={vRow.key}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vRow.start}px)`,
                      }}
                    >
                      <StakerRow
                        user={s.user}
                        assetIds={s.assetIds}
                        expanded={expandedUsers.has(s.user)}
                        onToggleExpanded={() => toggleExpanded(s.user)}
                        measureRef={virtualizer.measureElement}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}