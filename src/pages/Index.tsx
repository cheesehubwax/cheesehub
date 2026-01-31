import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import cheeseCoin from "@/assets/cheese-coin.png";

const Index = () => {
  return (
    <Layout>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cheese/5 via-transparent to-cheese-dark/5" />
        <div className="container relative py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            {/* Floating Bubble - same pattern as DropsHero, just bigger */}
            <div className="h-64 w-64 md:h-80 md:w-80 animate-float cheese-glow rounded-full flex items-center justify-center">
              <img src={cheeseCoin} alt="CHEESE Coin" className="w-56 md:w-72 object-contain" />
            </div>

            <h1 className="mt-8 text-4xl md:text-6xl font-bold mb-6">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Hub</span>
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

            {/* Price Bar - Placeholder */}
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <span className="px-4 py-2 bg-card/50 rounded-lg border border-border/50">
                Price data coming soon...
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Token Stats Banner - Placeholder */}
      <section className="container py-8">
        <Card className="bg-gradient-to-r from-cheese/5 via-background to-cheese/5 border-cheese/30 backdrop-blur-sm">
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground">Token statistics will be displayed here</p>
          </CardContent>
        </Card>
      </section>

      {/* CHEESETools Section */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Tools</span></h2>
        </div>

        {/* Grid of tools - 4x2 layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Row 1: CHEESEUp + CHEESEFaucet */}
          {/* CHEESEUp CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">⚡</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Up</span></h2>
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

          {/* CHEESEFaucet CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🧀</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Faucet</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the CHEESEFAUCET and CHEESECHEESE smart contracts, Hosted on GitHub users stake their $CHEESE to claim mine $CHEESE at a high APR
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <a href="https://cheeseonwax.github.io/tools/cheesefaucet.html" target="_blank" rel="noopener noreferrer">
                  Go to CHEESEFaucet
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Row 2: CHEESEDao + CHEESEFarm */}
          {/* CHEESE DAO CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🏛️</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Dao</span></h2>
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

          {/* CHEESEFarm CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🌱</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Farm</span></h2>
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

          {/* Row 3: CHEESELock + CHEESEDrop */}
          {/* CHEESELock CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🔐</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Lock</span></h2>
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

          {/* CHEESEDrops CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">💧</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Drop</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Powered by the NFTHIVEDROP smart contract and acting as an alternate Front-End CHEESEDrop allows all WAX users to create NFT drops and sell them for various WAX tokens
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/drops">
                  Go to CHEESEDrop
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Row 4: CHEESEWallet + CHEESEAmp */}
          {/* CHEESEWallet CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">👛</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Wallet</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-4">
                A simple, clean wallet UI. Send tokens OR NFTs. Stake WAX for resources. Rent CPU and NET. Buy and sell RAM. Vote for Block Producers or nominate a Proxy. Claim vote rewards.
              </p>
              <p className="text-cheese font-semibold max-w-sm mx-auto mb-6">
                + Manage Alcor LP Farm Positions
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

          {/* CHEESEAmp CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🎧</span>
              </div>
              <h2 className="text-2xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Amp</span></h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                A simple, clean NFT music player that populates a list automatically with your music NFTS. Play videos, create playlists, shuffle tracks and enjoy your musical blockchain assets like never before. Minimizes to mini player and keeps playing while you work or browse the web
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
        </div>
      </section>
    </Layout>
  );
};

export default Index;
