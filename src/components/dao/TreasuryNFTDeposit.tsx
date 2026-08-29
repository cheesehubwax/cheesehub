import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildDepositNFTToTreasuryAction, buildNFTDepositAction, buildAnnounceDepoAction } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { getIpfsUrl } from "@/lib/ipfsGateways";
import { Loader2, ArrowDownToLine, Wallet, Search, RefreshCw, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSquareGridRowHeight } from "@/hooks/useSquareGridRowHeight";
import { NFTGridCard } from "@/components/shared/NFTGridCard";

interface UserNFTItem {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema?: string;
  template_id?: string;
  mint?: string;
}

interface TreasuryNFTDepositProps {
  daoName: string;
  onDeposited: () => void;
}

type SortOption = "newest" | "oldest" | "name" | "collection";

const COLUMNS = 6;
const ROW_HEIGHT = 120;

export function TreasuryNFTDeposit({ daoName, onDeposited }: TreasuryNFTDepositProps) {
  const { accountName, session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [nfts, setNfts] = useState<UserNFTItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [schemaFilter, setSchemaFilter] = useState<string>("all");

  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = useSquareGridRowHeight(parentRef, { columns: COLUMNS, fallback: ROW_HEIGHT });

  useEffect(() => {
    if (!accountName) { setLoading(false); return; }
    loadUserNFTs();
  }, [accountName]);

  async function loadUserNFTs() {
    setLoading(true);
    try {
      const response = await fetch(
        `https://wax.api.atomicassets.io/atomicassets/v1/assets?owner=${accountName}&limit=500&order=desc&sort=asset_id`
      );
      const json = await response.json();
      if (json.success && json.data) {
        setNfts(json.data.map((asset: any) => {
          const data = asset.data || {};
          let image = data.img || data.image || "";
          if (image && !image.startsWith("http") && (image.startsWith("Qm") || image.startsWith("bafy"))) {
            image = getIpfsUrl(image);
          }
          return {
            asset_id: asset.asset_id,
            name: data.name || `NFT #${asset.asset_id}`,
            image,
            collection: asset.collection?.collection_name || "",
            schema: asset.schema?.schema_name || "",
            template_id: asset.template?.template_id || "",
            mint: asset.template_mint || "",
          };
        }));
      }
    } catch (e) {
      console.error("Error loading user NFTs:", e);
    }
    setLoading(false);
  }

  // Derive collections
  const collections = useMemo(() => {
    const map = new Map<string, number>();
    nfts.forEach(nft => map.set(nft.collection, (map.get(nft.collection) || 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [nfts]);

  // Derive schemas for selected collection
  const schemas = useMemo(() => {
    if (collectionFilter === "all") return [];
    const map = new Map<string, number>();
    nfts.filter(nft => nft.collection === collectionFilter).forEach(nft => {
      if (nft.schema) map.set(nft.schema, (map.get(nft.schema) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [nfts, collectionFilter]);

  const handleCollectionChange = useCallback((value: string) => {
    setCollectionFilter(value);
    setSchemaFilter("all");
  }, []);

  // Filter and sort
  const filteredNFTs = useMemo(() => {
    let result = [...nfts];
    if (collectionFilter !== "all") result = result.filter(nft => nft.collection === collectionFilter);
    if (schemaFilter !== "all") result = result.filter(nft => nft.schema === schemaFilter);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(nft =>
        nft.name.toLowerCase().includes(query) ||
        nft.collection.toLowerCase().includes(query) ||
        nft.asset_id.includes(query) ||
        (nft.schema && nft.schema.toLowerCase().includes(query))
      );
    }
    switch (sortBy) {
      case "collection": result.sort((a, b) => a.collection.localeCompare(b.collection)); break;
      case "name": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "newest": result.sort((a, b) => b.asset_id.localeCompare(a.asset_id, undefined, { numeric: true })); break;
      case "oldest": result.sort((a, b) => a.asset_id.localeCompare(b.asset_id, undefined, { numeric: true })); break;
    }
    return result;
  }, [nfts, collectionFilter, schemaFilter, searchQuery, sortBy]);

  const rowCount = Math.ceil(filteredNFTs.length / COLUMNS);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  const toggleNFT = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 50) next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allSelected = filteredNFTs.length > 0 && filteredNFTs.every(nft => selected.has(nft.asset_id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredNFTs.slice(0, 50).map(nft => nft.asset_id)));
    }
  }, [filteredNFTs, selected]);

  const handleDeposit = async () => {
    if (!session || !accountName || selected.size === 0) return;
    setDepositing(true);

    const assetIds = Array.from(selected);
    const actions = [
      buildAnnounceDepoAction(accountName),
      buildNFTDepositAction(accountName, daoName, assetIds),
      buildDepositNFTToTreasuryAction(accountName, daoName, assetIds),
    ];

    const result = await executeTransaction(actions, {
      successTitle: "NFTs Deposited! ",
      successDescription: `${assetIds.length} NFT(s) deposited to ${daoName} treasury`,
    });

    if (result.success) {
      setSelected(new Set());
      onDeposited();
      loadUserNFTs();
    }
    setDepositing(false);
  };

  if (!isConnected) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg text-center">
        <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connect your wallet to deposit NFTs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-primary" />
          <h4 className="font-medium">Deposit NFTs to Treasury</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadUserNFTs()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, collection, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={collectionFilter} onValueChange={handleCollectionChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Collection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({nfts.length})</SelectItem>
            {collections.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                {col.name} ({col.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {collectionFilter !== "all" && schemas.length > 0 && (
          <Select value={schemaFilter} onValueChange={setSchemaFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Schema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schemas</SelectItem>
              {schemas.map(s => (
                <SelectItem key={s.name} value={s.name}>{s.name} ({s.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="collection">Collection</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection Actions */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading NFTs...
            </span>
          ) : (
            <>{selected.size} selected {selected.size >= 50 && "(max 50)"}</>
          )}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll} disabled={filteredNFTs.length === 0}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            Clear
          </Button>
        </div>
      </div>

      {/* NFT Grid - Virtualized */}
      <div ref={parentRef} className="h-[560px] overflow-auto rounded-md border border-border">
        {loading && nfts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading NFTs...</span>
          </div>
        ) : filteredNFTs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ImageIcon className="h-8 w-8 mb-2" />
            <p>{nfts.length === 0 ? "No NFTs in wallet" : "No NFTs match filter"}</p>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIndex = virtualRow.index * COLUMNS;
              const rowNFTs = filteredNFTs.slice(startIndex, startIndex + COLUMNS);
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="grid grid-cols-6 gap-2 p-1"
                >
                  {rowNFTs.map(nft => (
                    <NFTGridCard
                      key={nft.asset_id}
                      nft={nft}
                      isSelected={selected.has(nft.asset_id)}
                      onToggle={() => toggleNFT(nft.asset_id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Button
        onClick={handleDeposit}
        disabled={depositing || selected.size === 0}
        className="w-full"
      >
        {depositing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Depositing...
          </>
        ) : (
          <>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit {selected.size > 0 ? `${selected.size} NFT(s)` : ""}
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Anyone can deposit NFTs. To withdraw, create an NFT Transfer proposal.
      </p>
    </div>
  );
}
