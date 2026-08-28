import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { formatBytes } from '@/components/wallet/WalletResources';
import type { CheeseRamStats, ContractReserves } from '@/lib/cheeseRam';

interface RamStatsBarProps {
  stats: CheeseRamStats | null | undefined;
  reserves: ContractReserves | null | undefined;
  isLoading: boolean;
}

const formatNumber = (value: number, decimals = 4) =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function RamStatsBar({ stats, reserves, isLoading }: RamStatsBarProps) {
  const dash = '-';

  const items = [
    { label: 'RAM Purchases', emoji: '🧾', value: isLoading || !stats ? dash : stats.totalPurchases.toLocaleString() },
    { label: 'RAM Bought', emoji: '💾', value: isLoading || !stats ? dash : formatBytes(stats.totalBytesBought) },
    { label: 'CHEESE Received', emoji: '🧀', value: isLoading || !stats ? dash : formatNumber(stats.totalCheeseReceived) },
    { label: 'CHEESE Nulled', emoji: '⛔', value: isLoading || !stats ? dash : formatNumber(stats.totalCheeseNulled) },
    { label: 'RAM Sales', emoji: '🔁', value: isLoading || !stats ? dash : stats.totalSales.toLocaleString() },
    { label: 'RAM Sold Back', emoji: '📤', value: isLoading || !stats ? dash : formatBytes(stats.totalBytesSoldBack) },
    { label: 'CHEESE Paid Out', emoji: '💸', value: isLoading || !stats ? dash : formatNumber(stats.totalCheesePaidOut) },
    { label: 'WAX Staked', emoji: '🔒', value: isLoading || !stats ? dash : formatNumber(stats.totalWaxStaked, 2) },
  ];


  return (
    <div className="rounded-xl p-4 max-w-2xl w-full bg-card border border-border/50">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <OpenMojiIcon emoji={item.emoji} size={16} />
              <span className="text-sm font-bold font-mono text-foreground">{item.value}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
