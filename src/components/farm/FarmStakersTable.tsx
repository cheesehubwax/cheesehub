import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Users, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useFarmStakers } from "@/hooks/useFarmStakers";
import type { StakerAssetMeta } from "@/lib/farmStakers";

interface FarmStakersTableProps {
  farmName: string;
}

const PREVIEW_LIMIT = 8;

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

function StakerRow({
  user,
  assetIds,
  assets,
}: {
  user: string;
  assetIds: string[];
  assets: Map<string, StakerAssetMeta>;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? assetIds : assetIds.slice(0, PREVIEW_LIMIT);
  const overflow = assetIds.length - PREVIEW_LIMIT;

  return (
    <TableRow>
      <TableCell className="p-2 align-top">
        <a
          href={`https://waxblock.io/account/${user}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-primary hover:underline"
        >
          {user}
        </a>
      </TableCell>
      <TableCell className="p-2 align-top">
        <Badge variant="outline" className="font-mono">{assetIds.length}</Badge>
      </TableCell>
      <TableCell className="p-2 align-top">
        <div className="flex flex-wrap gap-1.5">
          {visible.map(id => (
            <Thumb key={id} assetId={id} meta={assets.get(id)} />
          ))}
          {!expanded && overflow > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="h-8 px-2 rounded bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 inline-flex items-center gap-1"
            >
              +{overflow} <ChevronDown className="h-3 w-3" />
            </button>
          )}
          {expanded && overflow > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="h-8 px-2 rounded bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 inline-flex items-center gap-1"
            >
              Collapse <ChevronUp className="h-3 w-3" />
            </button>
          )}
        </div>
      </TableCell>
      <TableCell className="p-2 align-top">
        <a
          href={`https://waxblock.io/account/${user}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-primary"
          aria-label={`Open ${user} on waxblock`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </TableCell>
    </TableRow>
  );
}

export function FarmStakersTable({ farmName }: FarmStakersTableProps) {
  const { stakers, assets, isLoading, isFetching, error, refetch } = useFarmStakers(farmName, true);

  const totalStaked = stakers.reduce((sum, s) => sum + s.assetIds.length, 0);

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="w-20">Staked</TableHead>
                  <TableHead>NFTs</TableHead>
                  <TableHead className="w-12">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stakers.map(s => (
                  <StakerRow key={s.user} user={s.user} assetIds={s.assetIds} assets={assets} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}