import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sprout } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { FarmInfo, FARM_TYPE_LABELS, FarmType } from "@/lib/farm";
import { useNavigate } from "react-router-dom";
import { useIpfsImageSrc } from "@/hooks/useIpfsImageSrc";
import type { ClaimedToken } from "@/lib/farmClaimHistory";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

function formatAmount(val: string | number): string {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(num < 1 ? 4 : 2);
}

function formatPayoutInterval(seconds: number): string {
  if (seconds <= 0) return "N/A";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return hours === 1 ? "1 hour" : `${hours}h`;
}

function getFarmTypeLabel(farmType: number): string {
  const types: Record<number, FarmType> = { 0: "collections", 1: "schemas", 2: "templates", 3: "attributes" };
  return FARM_TYPE_LABELS[types[farmType] || "collections"];
}

function getStatusInfo(farm: FarmInfo): { label: string; className: string } {
  const now = Math.floor(Date.now() / 1000);

  if (farm.status === 3) return { label: "Permanently Closed", className: "bg-destructive/20 text-destructive border-destructive/30" };
  if (farm.status === 2) return { label: "Closed", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
  if (farm.status === 0) return { label: "Under Construction", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  if (farm.expiration > 0 && farm.expiration < now) return { label: "Expired", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
  if (farm.is_active) return { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" };
  return { label: "Inactive", className: "bg-muted text-muted-foreground border-border" };
}

function getDaysRemaining(expiration: number): string {
  if (expiration === 0) return "No expiry";
  const now = Math.floor(Date.now() / 1000);
  const diff = expiration - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  if (days > 365) return `${Math.floor(days / 365)}y ${days % 365}d`;
  if (days > 0) return `${days}d remaining`;
  const hours = Math.floor(diff / 3600);
  return `${hours}h remaining`;
}

export function FarmCard({ farm, userClaimed }: { farm: FarmInfo; userClaimed?: ClaimedToken[] }) {
  const navigate = useNavigate();
  const logo = useIpfsImageSrc(farm.logo);
  const status = getStatusInfo(farm);

  return (
    <Card
      className="bg-card/80 border-primary/30 shadow-lg transition-all cursor-pointer group flex flex-col"
      onClick={() => navigate(`/farm/${farm.farm_name}`)}
    >
      <CardContent className="p-4 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {logo.src ? (
              <img src={logo.src} alt={farm.farm_name} className="h-full w-full object-cover" onError={logo.onError} />
            ) : (
              <Sprout className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-sm">
              {farm.farm_name}
            </h3>
            <p className="text-xs text-foreground/70">by {farm.creator}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge className={`text-[10px] ${status.className}`}>{status.label}</Badge>
          <Badge variant="outline" className="text-[10px] border-border/50 text-foreground">{getFarmTypeLabel(farm.farm_type)}</Badge>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-3 text-xs text-foreground">
          <OpenMojiIcon emoji="🖼️" size={18} /> {farm.staked_count} NFTs Staked
          <span className="flex items-center gap-1">
            🕐 {getDaysRemaining(farm.expiration)}
          </span>
        </div>

        {/* Payout Interval */}
        <div className="mt-2 text-xs text-foreground flex items-center gap-1">
          <OpenMojiIcon emoji="💵" size={18} /> Payout every {formatPayoutInterval(farm.payout_interval)}
        </div>

        {/* Reward pools */}
        {farm.reward_pools.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-2">
            {farm.reward_pools.map((pool, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <TokenLogo contract={pool.contract} symbol={pool.symbol} size="sm" />
                <span className="font-mono text-foreground">
                  {formatAmount(pool.balance)} {pool.symbol}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* User's lifetime claimed (only if connected & ever claimed) */}
        {userClaimed && userClaimed.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cheese/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              You've claimed
            </p>
            <div className="flex flex-wrap gap-2">
              {userClaimed.map((c, i) => (
                <div key={`${c.contract}:${c.symbol}:${i}`} className="flex items-center gap-1 text-xs">
                  <TokenLogo contract={c.contract} symbol={c.symbol} size="sm" />
                  <span className="font-mono text-cheese">
                    {formatAmount(c.amount)} {c.symbol}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Details */}
        <div className="mt-auto pt-3">
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
