import { useState, useMemo, useCallback, useRef } from "react";
import { Check, Search, ImageOff, Loader2, Package, RefreshCw, SortAsc, SortDesc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUserNFTs } from "@/hooks/useUserNFTs";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useWax } from "@/context/WaxContext";

interface PremintNFTPickerProps {
  collectionName: string;
  selectedAssetIds: string[];
  onSelectionChange: (assetIds: string[]) => void;
}

const ITEMS_PER_ROW = 3;
const ITEM_HEIGHT = 160;

export function PremintNFTPicker({
  collectionName,
  selectedAssetIds,
  onSelectionChange,
}: PremintNFTPickerProps) {
  const { session } = useWax();
  const accountName = session?.actor?.toString() || null;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "name" | "collection">("newest");
  const parentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { 
    nfts, 
    isLoading: loading, 
    loadingProgress, 
    error, 
    refetch,
    collections 
  } = useUserNFTs(accountName, collectionName || undefined);

  const progress = loadingProgress.total > 0 
    ? (loadingProgress.loaded / loadingProgress.total) * 100 
    : 0;

  const filteredNFTs = useMemo(() => {
    let result = [...nfts];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (nft) =>
          nft.name.toLowerCase().includes(query) ||
          nft.asset_id.includes(query) ||
          nft.collection.toLowerCase().includes(query)
      );
    }

    switch (sortOrder) {
      case "newest":
        result.sort((a, b) => parseInt(b.asset_id) - parseInt(a.asset_id));
        break;
      case "oldest":
        result.sort((a, b) => parseInt(a.asset_id) - parseInt(b.asset_id));
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "collection":
        result.sort((a, b) => a.collection.localeCompare(b.collection));
        break;
    }

    return result;
  }, [nfts, searchQuery, sortOrder]);

  const rowCount = Math.ceil(filteredNFTs.length / ITEMS_PER_ROW);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 3,
  });

  const toggleNFTSelection = useCallback((assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      onSelectionChange(selectedAssetIds.filter((id) => id !== assetId));
    } else {
      onSelectionChange([...selectedAssetIds, assetId]);
    }
  }, [selectedAssetIds, onSelectionChange]);

  const selectAll = useCallback(() => {
    const allIds = filteredNFTs.map((nft) => nft.asset_id);
    if (selectedAssetIds.length === filteredNFTs.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  }, [filteredNFTs, selectedAssetIds, onSelectionChange]);

  const clearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  if (!collectionName) {
    return (
      <div className="p-6 border border-dashed border-border/50 rounded-lg text-center">
        <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Select a collection first to see your NFTs
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 border border-dashed border-border/50 rounded-lg text-center space-y-4">
        <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
        <div>
          <p className="text-sm text-muted-foreground mb-2">Loading your NFTs...</p>
          <p className="text-xs text-muted-foreground/70">May take up to 30 seconds, please be patient</p>
        </div>
        {progress > 0 && progress < 100 && (
          <div className="max-w-xs mx-auto">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}%</p>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-dashed border-destructive/50 rounded-lg text-center">
        <p className="text-sm text-destructive mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="p-6 border border-dashed border-border/50 rounded-lg text-center">
        <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No NFTs found in this collection
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search NFTs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">
              <span className="flex items-center gap-2">
                <SortDesc className="h-3 w-3" /> Newest
              </span>
            </SelectItem>
            <SelectItem value="oldest">
              <span className="flex items-center gap-2">
                <SortAsc className="h-3 w-3" /> Oldest
              </span>
            </SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="collection">Collection</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={refetch} title="Refresh NFTs">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {selectedAssetIds.length} of {filteredNFTs.length} selected
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
            {selectedAssetIds.length === filteredNFTs.length ? "Deselect All" : "Select All"}
          </Button>
          {selectedAssetIds.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div
        ref={parentRef}
        className="h-80 border border-border/50 rounded-lg overflow-auto"
        style={{ contain: "strict" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * ITEMS_PER_ROW;
            const rowNFTs = filteredNFTs.slice(startIndex, startIndex + ITEMS_PER_ROW);

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
                className="grid grid-cols-3 gap-2 p-2"
              >
                {rowNFTs.map((nft) => (
                  <NFTCard
                    key={nft.asset_id}
                    nft={nft}
                    isSelected={selectedAssetIds.includes(nft.asset_id)}
                    onToggle={() => toggleNFTSelection(nft.asset_id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        These NFTs will be transferred to the drop contract when you create the drop.
      </p>
    </div>
  );
}

interface NFTCardProps {
  nft: {
    asset_id: string;
    name: string;
    image: string;
    collection: string;
    mint?: string;
  };
  isSelected: boolean;
  onToggle: () => void;
}

function NFTCard({ nft, isSelected, onToggle }: NFTCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex flex-col items-center p-2 rounded-lg border-2 transition-all",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-transparent bg-muted/50 hover:border-primary/50"
      )}
    >
      <div className="relative w-full aspect-square rounded overflow-hidden mb-1">
        {imageError ? (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <Check className="h-6 w-6 text-primary" />
          </div>
        )}
      </div>
      <span className="text-xs font-medium truncate w-full text-center">
        {nft.name || "Unnamed"}
      </span>
      <span className="text-[10px] text-muted-foreground">
        #{nft.mint || nft.asset_id}
      </span>
    </button>
  );
}
