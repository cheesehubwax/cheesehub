import { OpenMojiIcon } from "@/components/OpenMojiIcon";

interface DropStatsBarProps {
  activeOfficialDrops: number;
  totalSold: number;
  cheeseNulled: number;
  xCheeseValue: number;
  cheeseReserve: number;
  isLoading: boolean;
}

export function DropStatsBar({ activeOfficialDrops, totalSold, cheeseNulled, xCheeseValue, cheeseReserve, isLoading }: DropStatsBarProps) {
  const statItems = [
    {
      label: "Active Official Drops",
      value: isLoading ? "-" : activeOfficialDrops.toLocaleString(),
      emoji: "⭐",
    },
    {
      label: "$CHEESE Collected",
      value: isLoading ? "-" : totalSold.toLocaleString(),
      emoji: "🧀",
    },
    {
      label: "$CHEESE Nulled",
      value: isLoading ? "-" : cheeseNulled.toLocaleString(),
      emoji: "⛔",
    },
    {
      label: "xCHEESE Value",
      value: isLoading ? "-" : xCheeseValue.toLocaleString(),
      emoji: "✖️",
    },
    {
      label: "cheesereserv",
      value: isLoading ? "-" : cheeseReserve.toLocaleString(),
      emoji: "🏦",
    },
  ];

  return (
    <div className="rounded-xl p-4 max-w-3xl w-full bg-card border border-border/50">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
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
