import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingCart } from "lucide-react";
import cheeseCoin from "@/assets/cheese-coin.png";
import walletIcon from "@/assets/wallet-icon.png";
import { TokenStatsBanner } from "@/components/home/TokenStatsBanner";
import { CheesePriceBar } from "@/components/home/CheesePriceBar";
import { CheeseHistorySection } from "@/components/home/CheeseHistorySection";

const Index = () => {
  return (
    <Layout>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cheese/5 via-transparent to-cheese-dark/5" />
        <div className="container relative py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            {/* Floating Bubble - same pattern as DropsHero, just bigger */}
            <div className="h-64 w-64 md:h-80 md:w-80 animate-float cheese-bubble rounded-full flex items-center justify-center">
              <img src={cheeseCoin} alt="CHEESE Coin" className="w-56 md:w-72 object-contain" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-6 flex items-center gap-3">
              <span><span className="text-cheese">CHEESE</span><span className="text-foreground">Hub</span></span>
              <span className="text-sm font-bold px-2 py-1 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Unlocking Meme-Fi on the WAX Blockchain
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <a href="https://cheeseonwax.github.io/" target="_blank" rel="noopener noreferrer">
                  Website
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-cheese/50 hover:bg-cheese/10 text-foreground font-semibold">
                <a href="https://cheeseonwax.github.io/cheesepaper.pdf" target="_blank" rel="noopener noreferrer">
                  White paper
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>

            {/* Price Bar */}
            <CheesePriceBar />
          </div>
        </div>
      </section>

      {/* Token Stats Banner */}
      <TokenStatsBanner />

      {/* CHEESE History Section */}
      <CheeseHistorySection />

      {/* CHEESETools Section */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Tools</span></h2>
        </div>

        {/* Grid of tools - 4x2 layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* CHEESEUp */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">⚡</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Up</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the CHEESEPOWERZ smart contract CHEESEUp allows $CHEESE holders to power-up CPU and NET with $CHEESE. The $CHEESE is sent to eosio.null and leaves circulation forever
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/powerup">
                  Go to CHEESEUp
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESENull */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">⛔</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Null</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the CHEESEBURNER smart contract. Perpetually NULLS $CHEESE. Anyone can call the NULL action
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/cheesenull">
                  Go to CHEESENull
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEFarm */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🌱</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Farm</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the FARMS.WAXDAO and CHEESEFEEFEE smart contracts and acting as an alternate Front-End CHEESEFarm allows all WAX users to create and participate in V2 non-custodial NFT staking farms
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/farm">
                  Go to CHEESEFarm
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEDao */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🏛️</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Dao</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the DAO.WAXDAO and CHEESEFEEFEE smart contracts and acting as an alternate Front-End CHEESEDao allows all WAX users to create DAOs and vote on Governance Proposals
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/dao">
                  Go to CHEESEDao
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEDrip */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">💧</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Drip</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the WAXDAOESCROW Smart Contract CHEESEDrip allows anyone to create, receive and manage slow drip escrows
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/drip">
                  Go to CHEESEDrip
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESELock */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🔐</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Lock</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the WAXDAOLOCKER smart contract and acting as an alternate Front-End CHEESELock allows all WAX users to time-lock tokens and/or LP tokens
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/locker">
                  Go to CHEESELock
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEDrop */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-cheese mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Drop</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the NFTHIVEDROP smart contract and acting as an alternate Front-End CHEESEDrop Shows All Current $CHEESE NFT Drops
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/drops">
                  Go to CHEESEDrop
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEWallet */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <img src={walletIcon} alt="Wallet" className="h-12 w-12 object-contain" />
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Wallet</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-4">
                A simple, clean wallet UI. Send tokens OR NFTs. Stake WAX for resources. Rent CPU and NET. Buy and sell RAM. Vote for Block Producers or nominate a Proxy. Claim vote rewards.
              </p>
              <p className="text-cheese font-semibold max-w-sm mx-auto mb-6">
                + Manage Alcor LP Farm Positions<br />
                + Burn NFTs
              </p>
              <Button
                size="lg"
                className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold"
                onClick={() => window.dispatchEvent(new CustomEvent('open-cheese-wallet'))}
              >
                Open Wallet
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEAmp */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🎧</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Amp</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-4">
                Partially powered by the CHEESEAMPHUB smart contract CHEESEAmp is a simple, clean NFT music player that populates a list automatically with your music NFTS allowing you to play videos, create playlists and shuffle tracks. Minimizes to mini player and keeps playing while you work or browse the web
              </p>
              <p className="text-cheese font-semibold max-w-sm mx-auto mb-6">
                +Global WAX Radio Feature
              </p>
              <Button
                size="lg"
                className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold"
                onClick={() => window.dispatchEvent(new CustomEvent('open-cheese-amp'))}
              >
                Open CHEESEAmp
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEAds */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🗞️</span>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><span><span className="text-cheese">CHEESE</span><span className="text-foreground">Ads</span></span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the CHEESEBANNAD Smart Contract CHEESEAds allows anyone to rent Ad Banner space on CHEESEHub using WAX. Rent exclusive or shared slots
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/bannerads">
                  Go to CHEESEAds
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
