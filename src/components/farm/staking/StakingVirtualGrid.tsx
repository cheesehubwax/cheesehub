import React, { useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle } from "lucide-react";
import { OpenMojiIcon } from "@/components/OpenMojiIcon";
import { NFTGridCard } from "@/components/shared/NFTGridCard";
import { useSquareGridRowHeight } from "@/hooks/useSquareGridRowHeight";
import type { NFTAsset } from "./stakingMedia";

// ── Virtualized Grid (defined outside main component to avoid re-creation) ──

// Farm-specific NFT card wrapper that adds "staked elsewhere" tooltip
interface FarmNFTCardProps {
  nft: NFTAsset;
  isSelected: boolean;
  onToggle: () => void;
  stakedInFarm?: string;
  onNavigateToFarm?: () => void;
}

const FarmNFTCard = React.memo(function FarmNFTCard({ nft, isSelected, onToggle, stakedInFarm, onNavigateToFarm }: FarmNFTCardProps) {
  const isStakedElsewhere = Boolean(stakedInFarm);

  if (isStakedElsewhere) {
    return (
      <div className="opacity-60">
        <NFTGridCard
          nft={nft}
          isSelected={false}
          onToggle={onNavigateToFarm || (() => {})}
          borderClass="border-amber-500/50"
          extraBadge={
            <>
              <div className="absolute top-1 left-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-center">
                <span className="text-[8px] font-medium text-amber-400 leading-tight">
                  Staked in {stakedInFarm}
                </span>
              </div>
            </>
          }
          extraHoverContent={
            <div className="flex justify-between text-amber-500"><OpenMojiIcon emoji="⚠️" size={18} /> Staked in<span className="font-semibold">{stakedInFarm}</span></div>
          }
        />
      </div>
    );
  }

  return (
    <NFTGridCard
      nft={nft}
      isSelected={isSelected}
      onToggle={onToggle}
    />
  );
});

interface VirtualGridProps {
  items: NFTAsset[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  parentRef: React.RefObject<HTMLDivElement>;
  type: "stake" | "unstake";
  globallyStakedMap?: Map<string, string>;
  onNavigateToFarm?: (farmName: string) => void;
}

function getGridCols(): number {
  return 6;
}

export const VirtualGrid = React.memo(function VirtualGrid({
  items,
  selected,
  onToggle,
  parentRef,
  type,
  globallyStakedMap,
  onNavigateToFarm,
}: VirtualGridProps) {
  const [cols, setCols] = useState(getGridCols);
  const gridRowHeight = useSquareGridRowHeight(parentRef, { columns: cols });

  useEffect(() => {
    const handleResize = () => setCols(getGridCols());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rowCount = Math.ceil(items.length / cols);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => gridRowHeight,
    overscan: 3,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [gridRowHeight, virtualizer]);

  return (
    <div ref={parentRef} className="h-[560px] overflow-auto rounded-md border border-border">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const start = vRow.index * cols;
          const rowItems = items.slice(start, start + cols);
          return (
            <div
              key={vRow.key}
              className="absolute top-0 left-0 w-full grid grid-cols-6 gap-2 p-1"
              style={{
                height: `${vRow.size}px`,
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              {rowItems.map((nft) => {
                const stakedInFarm = type === "stake" ? globallyStakedMap?.get(nft.asset_id) : undefined;
                return (
                  <FarmNFTCard
                    key={nft.asset_id}
                    nft={nft}
                    isSelected={selected.has(nft.asset_id)}
                    onToggle={() => onToggle(nft.asset_id)}
                    stakedInFarm={stakedInFarm}
                    onNavigateToFarm={stakedInFarm && onNavigateToFarm ? () => onNavigateToFarm(stakedInFarm) : undefined}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

