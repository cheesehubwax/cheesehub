import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon, CheckCircle } from "lucide-react";
import { DaoInfo, UserNFT, fetchVotedNFTs } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { getIpfsUrl } from "@/lib/ipfsGateways";

interface NFTVotePickerProps {
  dao: DaoInfo;
  proposalId: number;
  onSelect: (assetIds: string[]) => void;
  selectedIds: string[];
}

export function NFTVotePicker({ dao, proposalId, onSelect, selectedIds }: NFTVotePickerProps) {
  const { accountName } = useWax();
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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

      // Fetch user NFTs matching DAO schemas
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

  const toggleNFT = (assetId: string) => {
    if (selectedIds.includes(assetId)) {
      onSelect(selectedIds.filter(id => id !== assetId));
    } else {
      onSelect([...selectedIds, assetId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading eligible NFTs...</span>
      </div>
    );
  }

  const eligibleNFTs = userNFTs.filter(nft => !votedIds.has(nft.asset_id));

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
        {eligibleNFTs.length > 0 && (
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
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
        {eligibleNFTs.map(nft => {
          const isSelected = selectedIds.includes(nft.asset_id);
          return (
            <div
              key={nft.asset_id}
              className={`relative rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
                isSelected
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border/40 hover:border-primary/30"
              }`}
              onClick={() => toggleNFT(nft.asset_id)}
            >
              <div className="aspect-square bg-muted/30 flex items-center justify-center">
                {nft.image ? (
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1">
                  <CheckCircle className="h-4 w-4 text-primary fill-primary/20" />
                </div>
              )}
              <p className="text-[10px] text-center truncate px-1 py-0.5">{nft.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
