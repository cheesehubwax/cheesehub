import { Layout } from "@/components/Layout";
import { SlotCalendar } from "@/components/bannerads/SlotCalendar";
import { BannerAdStatsBar } from "@/components/bannerads/BannerAdStatsBar";
import { playRandomFart } from "@/lib/fartSounds";
import cheeseBikini from "@/assets/cheeseads.png";

const BannerAds = () => {
  return (
    <Layout>
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
        <div className="flex flex-col items-center gap-8">
          <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
            <img src={cheeseBikini} alt="CHEESE Logo" className="w-24 h-24 object-contain" />
          </div>
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🗞️</span>
              <h1 className="text-3xl md:text-4xl font-bold"><span className="text-cheese">CHEESE</span><span className="text-foreground">Ads</span></h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
              <span className="text-2xl">🗞️</span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">Rent Banner Ad Slots on CHEESEHub. Your Banner Persists Across All Dapp Pages. Each Day has 2 Slots Available. Choose from Exclusive or Shared</p>
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
