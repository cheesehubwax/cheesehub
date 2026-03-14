import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Image as ImageIcon, CheckCircle } from "lucide-react";
import { buildDepositNFTToTreasuryAction, buildNFTDepositAction, buildAnnounceDepoAction } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { getIpfsUrl } from "@/lib/ipfsGateways";

interface UserNFTItem {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
}

interface TreasuryNFTDepositProps {
  daoName: string;
  onDeposited: () => void;
}

export function TreasuryNFTDeposit({ daoName, onDeposited }: TreasuryNFTDepositProps) {
  const { accountName, session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [nfts, setNfts] = useState<UserNFTItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

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
          };
        }));
      }
    } catch (e) {
      console.error("Error loading user NFTs:", e);
    }
    setLoading(false);
  }

  const toggleNFT = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
      successTitle: "NFTs Deposited! 🧀🖼️",
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
      <div className="text-center py-6 text-muted-foreground text-sm">
        Connect wallet to deposit NFTs
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const displayNFTs = nfts.slice(0, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Select NFTs to deposit ({selected.size} selected)
        </p>
        {selected.size > 0 && (
          <Button size="sm" onClick={handleDeposit} disabled={depositing}>
            {depositing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Deposit {selected.size} NFT{selected.size > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {nfts.length === 0 ? (
        <div className="text-center py-8">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No NFTs found in your wallet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto">
            {displayNFTs.map(nft => {
              const isSelected = selected.has(nft.asset_id);
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
          {displayNFTs.length < nfts.length && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setPage(p => p + 1)}>
              Load More ({nfts.length - displayNFTs.length} remaining)
            </Button>
          )}
        </>
      )}
    </div>
  );
}
