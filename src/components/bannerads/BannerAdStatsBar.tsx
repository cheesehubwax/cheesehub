import { useBannerAdStats } from "@/hooks/useBannerAdStats";
import { OpenMojiIcon } from "@/components/OpenMojiIcon";

const formatNumber = (num: number, decimals: number = 2) =>
  num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function BannerAdStatsBar() {
  const { data, isLoading } = useBannerAdStats();

  const statItems = [
    { label: "Ads Rented", value: isLoading ? "-" : (data?.totalAdsRented.toLocaleString() ?? "-"), emoji: "📢" },
    { label: "CHEESE Nulled", value: isLoading ? "-" : (data ? formatNumber(data.cheeseBurnt, 4) : "-"), emoji: "⛔" },
    { label: "WAX → CheesePowerz", value: isLoading ? "-" : (data ? formatNumber(data.waxToCheesepowerz, 4) : "-"), emoji: "⚡" },
    { label: "WAX → CheeseBurner", value: isLoading ? "-" : (data ? formatNumber(data.waxToCheeseburner, 4) : "-"), emoji: "📈" },
  ];

  return (
    <div className="rounded-xl p-4 max-w-3xl w-full bg-card border border-border/50">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statItems.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <OpenMojiIcon emoji={stat.emoji} size={16} />
              <span className="text-lg font-bold font-mono text-foreground">{stat.value}</span>
            </div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
