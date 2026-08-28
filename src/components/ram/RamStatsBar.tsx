import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { formatBytes } from '@/components/wallet/WalletResources';
import type { CheeseRamStats } from '@/lib/cheeseRam';

interface RamStatsBarProps {
  stats: CheeseRamStats | null | undefined;
  isLoading: boolean;
}

const formatNumber = (value: number, decimals = 4) =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function RamStatsBar({ stats, isLoading }: RamStatsBarProps) {
  const dash = '-';
  const value = (n: number) => (isLoading || !stats ? dash : formatNumber(n));
  const count = (n: number) => (isLoading || !stats ? dash : n.toLocaleString());
  const bytes = (n: number) => (isLoading || !stats ? dash : formatBytes(n));

  const topItems = [
    { label: 'RAM Purchases', emoji: '🧾', value: count(stats?.totalPurchases ?? 0) },
    { label: 'RAM Bought', emoji: '💾', value: bytes(stats?.totalBytesBought ?? 0) },
    { label: 'RAM Sales', emoji: '🔁', value: count(stats?.totalSales ?? 0) },
    { label: 'RAM Sold', emoji: '📤', value: bytes(stats?.totalBytesSoldBack ?? 0) },
  ];

  const middleItems = [
    { label: 'CHEESE Nulled', emoji: '⛔', value: value(stats?.totalCheeseNulled ?? 0), unit: 'CHEESE' },
    { label: 'CHEESE to xCHEESE', emoji: '✖️', value: value(stats?.totalCheeseToXcheese ?? 0), unit: 'CHEESE' },
    { label: 'CHEESEBurner', emoji: '🔥', value: value(stats?.totalWaxToBurner ?? 0), unit: 'WAX' },
    { label: 'CHEESEPowerz', emoji: '⚡', value: value(stats?.totalWaxToPowerz ?? 0), unit: 'WAX' },
    { label: 'CHEESE Bought Back', emoji: '🔄', value: value(stats?.totalCheeseBuyback ?? 0), unit: 'CHEESE' },
  ];

  return (
    <div className="rounded-xl p-4 max-w-4xl w-full bg-card border border-border/50 space-y-4">
      {/* Top row — RAM activity */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {topItems.map((item) => (
          <div key={item.label} className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <OpenMojiIcon emoji={item.emoji} size={16} />
              <span className="text-sm font-bold font-mono text-foreground">{item.value}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border/50" />

      {/* Middle row — CHEESE distribution */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {middleItems.map((item) => (
          <div key={item.label} className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <OpenMojiIcon emoji={item.emoji} size={16} />
              <span className="text-sm font-bold font-mono text-foreground">
                {item.value} <span className="text-[10px] text-muted-foreground font-normal">{item.unit}</span>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border/50" />

      {/* Bottom row — WAX staked */}
      <div className="flex justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <OpenMojiIcon emoji="🔒" size={16} />
            <span className="text-sm font-bold font-mono text-foreground">
              {isLoading || !stats ? dash : formatNumber(stats.totalWaxStaked, 2)}{' '}
              <span className="text-[10px] text-muted-foreground font-normal">WAX</span>
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">WAX Staked</p>
        </div>
      </div>
    </div>
  );
}
