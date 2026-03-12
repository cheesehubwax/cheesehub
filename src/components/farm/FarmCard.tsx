import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sprout } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { FarmInfo, getIpfsUrl } from "@/lib/farm";

interface FarmCardProps {
  farm: FarmInfo;
  onClick: (farmName: string) => void;
}

export function FarmCard({ farm, onClick }: FarmCardProps) {
  const logoUrl = farm.logo ? getIpfsUrl(farm.logo) : "";
  const now = Math.floor(Date.now() / 1000);
  const isExpired = farm.expiration > 0 && farm.expiration < now;

  const rewardSymbols = farm.reward_pools.map(p => p.symbol).filter(Boolean).join(", ");

  return (
    <Card
      className="bg-card/80 border-border/50 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group"
      onClick={() => onClick(farm.farm_name)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={farm.farm_name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <Sprout className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {farm.farm_name}
              </h3>
              {farm.is_active && !isExpired ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Active</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{isExpired ? "Expired" : "Inactive"}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">by {farm.creator}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span>🎯 {farm.staked_count} staked</span>
              {rewardSymbols && <span>💰 {rewardSymbols}</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
