import { Zap, Flame } from "lucide-react";
import { PowerupStats } from "@/hooks/usePowerupStats";

interface PowerupStatsBarProps {
  stats: PowerupStats | null;
  isLoading: boolean;
}

export const PowerupStatsBar = ({ stats, isLoading }: PowerupStatsBarProps) => {
  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const statItems = [
    {
      label: "Total Powerups",
      value: isLoading ? "-" : (stats?.totalPowerups.toLocaleString() ?? "-"),
      icon: Zap,
      color: "text-primary"
    },
    {
      label: "WAX Burnt",
      value: isLoading ? "-" : (stats ? formatNumber(stats.waxBurnt, 4) : "-"),
      icon: Flame,
      color: "text-amber-500"
    },
    {
      label: "CHEESE Nulled",
      value: isLoading ? "-" : (stats ? formatNumber(stats.cheeseNulled, 4) : "-"),
      icon: Flame,
      color: "text-accent"
    },
  ];

  return (
    <div className="rounded-xl p-4 max-w-2xl w-full bg-card border border-border/50">
      <div className="grid grid-cols-3 gap-4">
        {statItems.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-lg font-bold font-mono text-foreground">{stat.value}</span>
            </div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
