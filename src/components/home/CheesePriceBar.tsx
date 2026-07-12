import { useState } from 'react';
import { useCheesePriceData } from '@/hooks/useCheesePriceData';
import { useCheeseStats } from '@/hooks/useCheeseStats';
import { useCheeseTVL } from '@/hooks/useCheeseTVL';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import waxSealAsset from '@/assets/wax-seal.png.asset.json';
import usdcAsset from '@/assets/usdc.png.asset.json';
import marketcapAsset from '@/assets/marketcap.png.asset.json';
import { CheeseSwapDialog } from '@/components/swap/CheeseSwapDialog';

function formatPrice(price: number, decimals: number = 8): string {
  return price.toFixed(decimals);
}

function formatUsdPrice(price: number): string {
  if (price < 0.0001) {
    return price.toFixed(8);
  } else if (price < 0.01) {
    return price.toFixed(6);
  } else if (price < 1) {
    return price.toFixed(4);
  }
  return price.toFixed(2);
}

function formatLargeValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatWaxValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M WAX`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K WAX`;
  }
  return `${value.toFixed(2)} WAX`;
}

export function CheesePriceBar() {
  const { data: priceData, isLoading: priceLoading, error: priceError, refetch: refetchPrice, isFetching: priceFetching } = useCheesePriceData();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats, isFetching: statsFetching } = useCheeseStats();
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapInputToken, setSwapInputToken] = useState<'WAX' | 'WAXUSDC'>('WAX');

  // Need WAX/USD price for TVL calculation - derive from CHEESE prices
  const waxUsdPrice = priceData && priceData.waxPrice > 0
    ? priceData.usdPrice / priceData.waxPrice
    : undefined;
  const cheeseUsdPrice = priceData?.usdPrice;
  const { data: tvlData, isLoading: tvlLoading, refetch: refetchTvl, isFetching: tvlFetching } = useCheeseTVL(waxUsdPrice, cheeseUsdPrice);

  const isLoading = priceLoading || statsLoading;
  const isAnyFetching = priceFetching || statsFetching || tvlFetching;

  const refreshAll = () => {
    refetchPrice();
    refetchStats();
    refetchTvl();
  };

  const marketCap = priceData && stats
    ? stats.circulatingSupply * priceData.usdPrice
    : 0;

  const openSwap = (inputToken: 'WAX' | 'WAXUSDC') => {
    setSwapInputToken(inputToken);
    setSwapOpen(true);
  };

  if (priceError) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-6 mb-2">
        {/* CHEESE/WAX Price */}
        <div className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2">
          <img src={waxSealAsset.url} alt="WAX" className="w-7 h-7 object-contain" />
          <div className="flex flex-col items-start">
            <span className="text-xs text-muted-foreground">CHEESE/WAX</span>
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span className="font-semibold text-foreground">
                {formatPrice(priceData?.waxPrice ?? 0, 4)} WAX
              </span>
            )}
          </div>
          <button
            onClick={() => openSwap('WAX')}
            className="ml-1 text-xs text-cheese hover:text-cheese/80 hover:underline transition-colors font-medium"
          >
            trade
          </button>
        </div>

        {/* CHEESE/USD Price */}
        <div className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2">
          <img src={usdcAsset.url} alt="USD" className="w-7 h-7 object-contain" />
          <div className="flex flex-col items-start">
            <span className="text-xs text-muted-foreground">CHEESE/USD</span>
            {isLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <span className="font-semibold text-foreground">
                ${formatUsdPrice(priceData?.usdPrice ?? 0)}
              </span>
            )}
          </div>
          <button
            onClick={() => openSwap('WAXUSDC')}
            className="ml-1 text-xs text-cheese hover:text-cheese/80 hover:underline transition-colors font-medium"
          >
            trade
          </button>
        </div>

      {/* Market Cap */}
      <div className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2">
        <img src={marketcapAsset.url} alt="Market Cap" className="w-7 h-7 object-contain" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Market Cap</span>
          {isLoading ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <span className="font-semibold text-foreground">
              {formatLargeValue(marketCap)}
            </span>
          )}
        </div>
      </div>

      {/* TVL */}
      <div className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2">
        <span className="text-lg">💰</span>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">TVL (All DEXs)</span>
          {tvlLoading || !tvlData ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">
                {formatLargeValue(tvlData.totalUSD)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatWaxValue(tvlData.totalWAX)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Refresh All */}
      <button
        onClick={refreshAll}
        disabled={isAnyFetching}
        className="flex items-center gap-1.5 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-3 py-2 hover:bg-cheese/20 transition-colors disabled:opacity-50"
        title="Refresh all price data"
      >
        <RefreshCw className={`w-4 h-4 text-muted-foreground ${isAnyFetching ? 'animate-spin' : ''}`} />
        <span className="text-xs text-muted-foreground hidden sm:inline">Refresh</span>
      </button>
    </div>

    <CheeseSwapDialog
      open={swapOpen}
      onOpenChange={setSwapOpen}
      inputToken={swapInputToken}
    />
    </>
  );
}
