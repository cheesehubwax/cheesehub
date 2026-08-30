// CHEESERam page — buy and sell WAX RAM with $CHEESE
import { useCallback, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { BuyRamCard } from '@/components/ram/BuyRamCard';
import { SellRamCard } from '@/components/ram/SellRamCard';
import { RamPricePanel } from '@/components/ram/RamPricePanel';
import { RamStatsBar } from '@/components/ram/RamStatsBar';
import { LiquidReservesPanel } from '@/components/ram/LiquidReservesPanel';
import { FundWaxPoolCard } from '@/components/ram/FundWaxPoolCard';
import { RamInfoDropdown } from '@/components/ram/RamInfoDropdown';

import { ResourceGauges, refreshResourceGauges } from '@/components/shared/ResourceGauges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWax } from '@/context/WaxContext';
import { useCheesePriceData } from '@/hooks/useCheesePriceData';
import {
  useAccountRam,
  useCheeseRamConfig,
  useCheeseRamReserves,
  useCheeseRamStats,
  useRamPrice,
} from '@/hooks/useCheeseRam';
import { useCheeseRamVoteRewards } from '@/hooks/useCheeseRamVoteRewards';
import { CHEESE_RAM_CONTRACT } from '@/lib/cheeseRam';
import cheeseRamOrb from '@/assets/cheeseram.png';
import ramStickAsset from '@/assets/ram-stick.png';
import { playRandomFart } from '@/lib/fartSounds';


const Ram = () => {
  const { accountName, refreshBalance } = useWax();
  const { data: config, refetch: refetchConfig } = useCheeseRamConfig();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useCheeseRamStats();
  const { data: reserves, refetch: refetchReserves } = useCheeseRamReserves();
  const { pricePerByte, cheesePerKb, history, refetch: refetchRamPrice } = useRamPrice();
  const { data: accountRam, refetch: refetchAccountRam } = useAccountRam(accountName);
  const { data: cheesePrice, refetch: refetchCheesePrice } = useCheesePriceData();
  const { refetch: refetchVoteRewards } = useCheeseRamVoteRewards();

  const liveWaxPerCheese = cheesePrice?.waxPrice && cheesePrice.waxPrice > 0 ? cheesePrice.waxPrice : null;
  const availableBytes = accountRam ? Math.max(0, accountRam.quota - accountRam.usage) : 0;

  // Refresh every on-page value after a buy/sell. The chain needs a moment to
  // apply the transaction, so we poll a few times instead of reading once.
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    },
    [],
  );

  const refreshAll = useCallback(() => {
    refetchStats();
    refetchReserves();
    refetchAccountRam();
    refetchRamPrice();
    refetchConfig();
    refetchCheesePrice?.();
    refetchVoteRewards();
    refreshBalance?.();
    refreshResourceGauges();
  }, [
    refetchStats,
    refetchReserves,
    refetchAccountRam,
    refetchRamPrice,
    refetchConfig,
    refetchCheesePrice,
    refetchVoteRewards,
    refreshBalance,
  ]);

  const handleComplete = useCallback(() => {
    refreshAll();
    [1500, 4000, 8000].forEach((delay) => {
      const id = window.setTimeout(refreshAll, delay);
      timersRef.current.push(id);
    });
  }, [refreshAll]);


  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-20 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseRamOrb} alt="CHEESE Ram" className="w-24 h-24 object-contain" />
            </div>

            <div className="text-center space-y-4">
              <RamInfoDropdown>
                <div className="flex items-center justify-center gap-2">
                  <img src={ramStickAsset} alt="RAM" className="h-7 w-auto object-contain" />
                  <h1 className="text-3xl md:text-4xl font-bold">
                    <span className="text-cheese">CHEESE</span>
                    <span className="text-foreground">Ram</span>
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                  <img src={ramStickAsset} alt="RAM" className="h-7 w-auto object-contain" />
                </div>
              </RamInfoDropdown>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Buy RAM with $CHEESE and sell RAM for $CHEESE. The $CHEESE spent is nulled and used to fund x-CHEESE
              </p>
            </div>

          </div>
        </div>
      </section>

      <main className="container pb-12 flex flex-col items-center gap-6">
        <ResourceGauges />
        <LiquidReservesPanel reserves={reserves} />
        <div className="w-full max-w-lg flex justify-center">
          <FundWaxPoolCard onComplete={handleComplete} />
        </div>
        <RamPricePanel cheesePerKb={cheesePerKb} pricePerByte={pricePerByte} history={history} />

        <Tabs defaultValue="buy" className="w-full max-w-lg">

          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="gap-2">
              <img src={ramStickAsset} alt="RAM" className="h-4 w-auto object-contain" />
              Buy RAM
            </TabsTrigger>
            <TabsTrigger value="sell" className="gap-2">
              <OpenMojiIcon emoji="📤" size={18} />
              Sell RAM
            </TabsTrigger>
          </TabsList>
          <TabsContent value="buy">
            <BuyRamCard
              config={config}
              pricePerByte={pricePerByte}
              liveWaxPerCheese={liveWaxPerCheese}
              onComplete={handleComplete}
            />
          </TabsContent>
          <TabsContent value="sell">
            <SellRamCard
              config={config}
              pricePerByte={pricePerByte}
              liveWaxPerCheese={liveWaxPerCheese}
              reserves={reserves}
              availableBytes={availableBytes}
              onComplete={handleComplete}
            />
          </TabsContent>

        </Tabs>

        <RamStatsBar stats={stats} isLoading={statsLoading} />

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Powered by the{' '}
            <a
              href={`https://waxblock.io/account/${CHEESE_RAM_CONTRACT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cheese hover:underline"
            >
              {CHEESE_RAM_CONTRACT}
            </a>{' '}
            smart contract.
          </p>
        </div>
      </main>
    </Layout>
  );
};

export default Ram;
