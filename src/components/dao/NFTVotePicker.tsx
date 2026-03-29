import { useState, useEffect, useRef, useMemo, useCallback, } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { DaoInfo, UserNFT, fetchVotedNFTs } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { getIpfsUrl } from "@/lib/ipfsGateways";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSquareGridRowHeight } from "@/hooks/useSquareGridRowHeight";
import { NFTGridCard } from "@/components/shared/NFTGridCard";

interface NFTVotePickerProps {
  dao: DaoInfo;
  proposalId: number;
  onSelect: (assetIds: string[]) => void;
  selectedIds: string[];
}

const COLUMNS = 6;
const ROW_HEIGHT = 120;

export function NFTVotePicker({ dao, proposalId, onSelect, selectedIds }: NFTVotePickerProps) {
  const { accountName } = useWax();
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = useSquareGridRowHeight(parentRef, { columns: COLUMNS, fallback: ROW_HEIGHT });

  useEffect(() => {
    if (!accountName) { setLoading(false); return; }
    loadNFTs();
  }, [accountName, proposalId]);

  async function loadNFTs() {
    setLoading(true);
    try {
      const [voted] = await Promise.all([
        fetchVotedNFTs(proposalId),
      ]);
      setVotedIds(new Set(voted));

      const allNFTs: UserNFT[] = [];
      for (const schema of dao.gov_schemas || []) {
        try {
          const response = await fetch(
            `https://wax.api.atomicassets.io/atomicassets/v1/assets?owner=${accountName}&collection_name=${schema.collection_name}&schema_name=${schema.schema_name}&limit=100`
          );
          const json = await response.json();
          if (json.success && json.data) {
            for (const asset of json.data) {
              const data = asset.data || {};
              let image = data.img || data.image || "";
              if (image && !image.startsWith("http")) {
                if (image.startsWith("Qm") || image.startsWith("bafy")) {
                  image = getIpfsUrl(image);
                }
              }
              allNFTs.push({
                asset_id: asset.asset_id,
                name: data.name || `NFT #${asset.asset_id}`,
                image,
                collection: asset.collection?.collection_name || "",
                schema: asset.schema?.schema_name || "",
                template_id: asset.template?.template_id || "",
              });
            }
          }
        } catch (e) {
          console.error("Error fetching user NFTs for schema:", schema, e);
        }
      }
      setUserNFTs(allNFTs);
    } catch (e) {
      console.error("Error loading NFTs for voting:", e);
    }
    setLoading(false);
  }

  const eligibleNFTs = useMemo(() => userNFTs.filter(nft => !votedIds.has(nft.asset_id)), [userNFTs, votedIds]);

  const rowCount = Math.ceil(eligibleNFTs.length / COLUMNS);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  const toggleNFT = useCallback((assetId: string) => {
    if (selectedIds.includes(assetId)) {
      onSelect(selectedIds.filter(id => id !== assetId));
    } else {
      onSelect([...selectedIds, assetId]);
    }
  }, [selectedIds, onSelect]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading eligible NFTs...</span>
      </div>
    );
  }

  if (eligibleNFTs.length === 0) {
    return (
      <div className="text-center py-4">
        <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          {userNFTs.length === 0
            ? "You don't hold any eligible NFTs for this DAO"
            : "All your eligible NFTs have already voted on this proposal"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Select NFTs to vote with ({selectedIds.length} selected)
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => onSelect(
            selectedIds.length === eligibleNFTs.length
              ? []
              : eligibleNFTs.map(n => n.asset_id)
          )}
        >
          {selectedIds.length === eligibleNFTs.length ? "Deselect All" : "Select All"}
        </Button>
      </div>
      <div ref={parentRef} className="h-[560px] overflow-auto rounded-md border border-border">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * COLUMNS;
            const rowNFTs = eligibleNFTs.slice(startIndex, startIndex + COLUMNS);
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
                {rowNFTs.map(nft => {
                  const isSelected = selectedIds.includes(nft.asset_id);
                  return (
                    <NFTGridCard
                      key={nft.asset_id}
                      nft={nft}
                      isSelected={isSelected}
                      onToggle={() => toggleNFT(nft.asset_id)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
