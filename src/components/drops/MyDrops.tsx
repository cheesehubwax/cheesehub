import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { Wallet, Package, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchUserDrops } from "@/services/atomicApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useMemo } from "react";

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

function getImageUrl(img: string | undefined): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http')) return img;
  if (img.startsWith('Qm') || img.startsWith('bafy')) return `${IPFS_GATEWAY}${img}`;
  return img;
}

export function MyDrops() {
  const { isConnected, login, accountName } = useWax();

  const { data: drops = [], isLoading } = useQuery({
    queryKey: ['userDrops', accountName],
    queryFn: () => fetchUserDrops(accountName!),
    enabled: !!accountName,
    staleTime: 1000 * 60 * 2,
  });

  const now = Date.now();
  
  const { activeDrops, pendingDrops, finishedDrops } = useMemo(() => {
    const active: typeof drops = [];
    const pending: typeof drops = [];
    const finished: typeof drops = [];
    drops.forEach((drop) => {
      const startTime = drop.startTime * 1000;
      const endTime = drop.endTime * 1000;
      const remaining = drop.maxClaimable - (drop.numClaimed || 0);
      const isSoldOut = remaining <= 0 && drop.maxClaimable > 0;
      const isEnded = now >= endTime;
      const isNotStarted = now < startTime;
      if (isEnded || isSoldOut) finished.push(drop);
      else if (isNotStarted) pending.push(drop);
      else active.push(drop);
    });
    return { activeDrops: active, pendingDrops: pending, finishedDrops: finished };
  }, [drops, now]);

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">Connect your wallet to see drops you've created.</p>
          <Button onClick={login} className="bg-primary hover:bg-primary/90 text-primary-foreground">Connect Wallet</Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card/50 border-border/50"><CardContent className="p-4">
            <Skeleton className="aspect-square w-full rounded-lg mb-4" />
            <Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" />
          </CardContent></Card>
        ))}
      </div>
    );
  }

  const renderDropCard = (drop: typeof drops[0]) => {
    const startTime = drop.startTime * 1000;
    const endTime = drop.endTime * 1000;
    const isActive = now >= startTime && now < endTime;
    const isUpcoming = now < startTime;
    const isEnded = now >= endTime;
    const remaining = drop.maxClaimable - (drop.numClaimed || 0);
    const isSoldOut = remaining <= 0 && drop.maxClaimable > 0;

    return (
      <Card key={drop.dropId} className="bg-card/50 border-border/50 overflow-hidden">
        <div className="relative aspect-square">
          <img src={getImageUrl(drop.image)} alt={drop.name} className="h-full w-full object-cover" />
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {isSoldOut ? <Badge variant="secondary">Sold Out</Badge>
              : isActive ? <Badge className="bg-green-500/90">Active</Badge>
              : isUpcoming ? <Badge variant="outline" className="bg-background/80">Upcoming</Badge>
              : isEnded ? <Badge variant="secondary">Ended</Badge> : null}
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold truncate">{drop.name}</h3>
            <p className="text-sm text-muted-foreground">{drop.price.toLocaleString()} {drop.currency}</p>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Claimed</span>
            <span className="font-medium">{drop.numClaimed || 0} / {drop.maxClaimable}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Start:</span><span>{format(new Date(startTime), "MMM d, yyyy h:mm a")}</span></div>
            <div className="flex justify-between"><span>End:</span><span>{format(new Date(endTime), "MMM d, yyyy h:mm a")}</span></div>
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={`https://nfthive.io/drop/${drop.dropId}`} target="_blank" rel="noopener noreferrer">
              View on NFT Hive<ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = (type: 'active' | 'pending' | 'finished') => (
    <Card className="col-span-full bg-card/50 border-border/50">
      <CardContent className="py-8 text-center">
        <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          {type === 'active' ? "No active drops." : type === 'pending' ? "No pending drops." : "No finished drops yet."}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">Active {activeDrops.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{activeDrops.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">Pending {pendingDrops.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{pendingDrops.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="finished" className="gap-2">Finished {finishedDrops.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{finishedDrops.length}</Badge>}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="active">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeDrops.length === 0 ? renderEmptyState('active') : activeDrops.map(renderDropCard)}</div>
        </TabsContent>
        <TabsContent value="pending">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{pendingDrops.length === 0 ? renderEmptyState('pending') : pendingDrops.map(renderDropCard)}</div>
        </TabsContent>
        <TabsContent value="finished">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{finishedDrops.length === 0 ? renderEmptyState('finished') : finishedDrops.map(renderDropCard)}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
