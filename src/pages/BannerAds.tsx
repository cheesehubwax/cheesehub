import { Layout } from "@/components/Layout";
import { SlotCalendar } from "@/components/bannerads/SlotCalendar";
import { BannerAdStatsBar } from "@/components/bannerads/BannerAdStatsBar";
import { playRandomFart } from "@/lib/fartSounds";
import cheeseBikini from "@/assets/cheeseads.png";

const BannerAds = () => {
  return (
    <Layout>
      <section className="container py-12 md:py-20">
        <div className="flex flex-col items-center gap-8">
          <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
            <img src={cheeseBikini} alt="CHEESE Logo" className="w-24 h-24 object-contain" />
          </div>
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">🗞️</span>
              <h1 className="text-3xl md:text-4xl font-bold"><span className="text-cheese">CHEESE</span><span className="text-foreground">Ads</span></h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
              <span className="text-3xl">🗞️</span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">Rent Banner Ad Slots on CHEESEHub. Your Banner Persists Across All Dapp Pages. Each Day has 2 Slots Available. Choose from Exclusive or Shared.</p>
            <div className="text-sm text-muted-foreground max-w-md mx-auto mt-2 space-y-1">
              <p className="text-foreground font-medium">Shared: 70 WAX/day</p>
              <p className="text-center text-muted-foreground">OR</p>
              <p className="text-foreground font-medium">Exclusive: 140 WAX/day</p>
              <p className="text-xs text-muted-foreground">Show 2 banners for less than 2 Exclusive Slots</p>
            </div>
          </div>
          <SlotCalendar />
          <BannerAdStatsBar />
          <p className="text-muted-foreground text-sm text-center max-w-lg mx-auto mt-8">
            Powered by the{" "}
            <a href="https://waxblock.io/account/cheesebannad" target="_blank" rel="noopener noreferrer" className="text-cheese hover:text-cheese-dark underline underline-offset-2 font-semibold">CHEESEBANNAD</a>{" "}
            Smart Contract
          </p>
        </div>
      </section>
    </Layout>
  );
};

export default BannerAds;
