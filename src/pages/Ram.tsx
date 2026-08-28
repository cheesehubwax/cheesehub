// CHEESERam page — buy and sell WAX RAM with $CHEESE
import { Layout } from '@/components/Layout';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { BuyRamCard } from '@/components/ram/BuyRamCard';
import { SellRamCard } from '@/components/ram/SellRamCard';
import { RamPricePanel } from '@/components/ram/RamPricePanel';
import { RamStatsBar } from '@/components/ram/RamStatsBar';
import { LiquidReservesPanel } from '@/components/ram/LiquidReservesPanel';
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
import { CHEESE_RAM_CONTRACT } from '@/lib/cheeseRam';
import cheeseRamOrb from '@/assets/cheeseram.png';
import { playRandomFart } from '@/lib/fartSounds';


const Ram = () => {
  const { accountName } = useWax();
  const { data: config } = useCheeseRamConfig();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useCheeseRamStats();
  const { data: reserves, refetch: refetchReserves } = useCheeseRamReserves();
  const { pricePerByte, cheesePerKb, history } = useRamPrice();
  const { data: accountRam, refetch: refetchAccountRam } = useAccountRam(accountName);
  const { data: cheesePrice } = useCheesePriceData();

  const liveWaxPerCheese = cheesePrice?.waxPrice && cheesePrice.waxPrice > 0 ? cheesePrice.waxPrice : null;
  const availableBytes = accountRam ? Math.max(0, accountRam.quota - accountRam.usage) : 0;


  const handleComplete = () => {
    refetchStats();
    refetchReserves();
    refetchAccountRam();
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative py-20 overflow-hidden">
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
              <div className="flex items-center justify-center gap-2">
                <OpenMojiIcon emoji="💾" size={24} className="text-2xl" />
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Ram</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <OpenMojiIcon emoji="💾" size={24} className="text-2xl" />
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Buy WAX RAM using $CHEESE, or sell RAM back for $CHEESE. The $CHEESE spent is sent to
                eosio.null and leaves circulation forever
              </p>
            </div>

          </div>
        </div>
      </section>

      <main className="container pb-12 flex flex-col items-center gap-8">
        <LiquidReservesPanel reserves={reserves} />
        <RamPricePanel cheesePerKb={cheesePerKb} history={history} />

        <Tabs defaultValue="buy" className="w-full max-w-2xl">

          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="gap-2">
              <OpenMojiIcon emoji="💾" size={18} />
              Buy RAM
            </TabsTrigger>
            <TabsTrigger value="sell" className="gap-2">
              <OpenMojiIcon emoji="📤" size={18} />
              Sell RAM
            </TabsTrigger>
          </TabsList>
          <TabsContent value="buy">
            <BuyRamCard config={config} pricePerByte={pricePerByte} onComplete={handleComplete} />
          </TabsContent>
          <TabsContent value="sell">
            <SellRamCard
              config={config}
              pricePerByte={pricePerByte}
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
