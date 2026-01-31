import { useCheeseStats } from '@/hooks/useCheeseStats';
import { useCheeseTVL } from '@/hooks/useCheeseTVL';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useCheesePriceData } from '@/hooks/useCheesePriceData';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Lock, 
  Fire, 
  Coins, 
  ChartLineUp, 
  ShieldCheck,
  Calendar
} from '@phosphor-icons/react';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}

function StatItem({ icon, label, value, subValue, highlight }: StatItemProps) {
  return (
    <div className="flex flex-col items-center text-center p-4">
      <div className={`mb-2 ${highlight ? 'text-cheese' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-cheese' : 'text-foreground'}`}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="flex flex-col items-center text-center p-4">
      <Skeleton className="h-6 w-6 mb-2 rounded-full" />
      <Skeleton className="h-3 w-16 mb-1" />
      <Skeleton className="h-5 w-24" />
    </div>
  );
}

export function TokenStatsBanner() {
  const { stats, loading: statsLoading } = useCheeseStats();
  const { waxPrice } = useWaxPrice();
  const { priceData } = useCheesePriceData(waxPrice);
  const { tvlData, loading: tvlLoading } = useCheeseTVL(waxPrice, priceData.priceInUsd);

  const loading = statsLoading || tvlLoading;

  const formatNumber = (num: number, decimals: number = 0) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(decimals);
  };

  const formatUSD = (num: number) => {
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-cheese/5 via-background to-cheese/5 border-cheese/30 backdrop-blur-sm">
        <CardContent className="py-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-cheese/5 via-background to-cheese/5 border-cheese/30 backdrop-blur-sm overflow-hidden">
      <CardContent className="py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 divide-y md:divide-y-0 md:divide-x divide-border/30">
          {/* Total Supply */}
          <StatItem
            icon={<Coins size={24} weight="duotone" />}
            label="Total Supply"
            value={formatNumber(stats?.totalSupply || 0)}
            subValue={`of ${formatNumber(stats?.maxSupply || 0)} max`}
          />

          {/* Locked Supply */}
          <StatItem
            icon={<Lock size={24} weight="duotone" />}
            label="Locked"
            value={formatNumber(stats?.lockedSupply || 0)}
            subValue={stats?.nextUnlock ? `Unlock ${stats.nextUnlock.year}` : undefined}
            highlight
          />

          {/* Burned (Nulled) */}
          <StatItem
            icon={<Fire size={24} weight="duotone" />}
            label="Burned"
            value={formatNumber(stats?.nulledBalance || 0)}
            subValue="Sent to eosio.null"
            highlight
          />

          {/* TVL */}
          <StatItem
            icon={<ChartLineUp size={24} weight="duotone" />}
            label="Total TVL"
            value={formatUSD(tvlData?.totalUSD || 0)}
            subValue={`${formatNumber(tvlData?.totalWAX || 0)} WAX`}
            highlight
          />

          {/* Contract Status */}
          <StatItem
            icon={<ShieldCheck size={24} weight="duotone" />}
            label="Contract"
            value={stats?.status || 'Loading'}
            subValue={stats?.isNulled ? 'Keys nulled' : 'Active'}
            highlight={stats?.isNulled}
          />

          {/* Next Unlock */}
          <StatItem
            icon={<Calendar size={24} weight="duotone" />}
            label="Next Unlock"
            value={stats?.nextUnlock ? String(stats.nextUnlock.year) : 'None'}
            subValue={stats?.nextUnlock ? `${formatNumber(stats.nextUnlock.amount)} CHEESE` : 'No pending unlocks'}
          />
        </div>
      </CardContent>
    </Card>
  );
}
