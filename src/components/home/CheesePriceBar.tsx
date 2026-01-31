import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useCheesePriceData } from '@/hooks/useCheesePriceData';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendUp, TrendDown } from '@phosphor-icons/react';

export function CheesePriceBar() {
  const { waxPrice, loading: waxLoading } = useWaxPrice();
  const { priceData, loading: cheeseLoading } = useCheesePriceData(waxPrice);

  const loading = waxLoading || cheeseLoading;
  const change24h = priceData.change24h;
  const isPositive = change24h >= 0;

  const formatPrice = (price: number, decimals: number = 6) => {
    if (price < 0.000001) return price.toExponential(2);
    return price.toFixed(decimals);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-3 text-sm">
      {/* CHEESE Price */}
      <div className="px-4 py-2 bg-card/50 rounded-lg border border-cheese/30 flex items-center gap-2">
        <span className="text-muted-foreground">CHEESE:</span>
        <span className="text-cheese font-semibold">${formatPrice(priceData.priceInUsd)}</span>
      </div>

      {/* WAX Price */}
      <div className="px-4 py-2 bg-card/50 rounded-lg border border-border/50 flex items-center gap-2">
        <span className="text-muted-foreground">WAX:</span>
        <span className="text-foreground font-semibold">${waxPrice.toFixed(4)}</span>
      </div>

      {/* 24h Change */}
      <div className={`px-4 py-2 rounded-lg border flex items-center gap-1 ${
        isPositive 
          ? 'bg-green-500/10 border-green-500/30 text-green-400' 
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}>
        {isPositive ? <TrendUp weight="bold" size={16} /> : <TrendDown weight="bold" size={16} />}
        <span className="font-semibold">{formatPercent(change24h)}</span>
        <span className="text-muted-foreground text-xs">24h</span>
      </div>
    </div>
  );
}
