import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import cheeseCoin from "@/assets/cheese-coin.png";
import { 
  CheesePriceBar, 
  TokenStatsBanner, 
  CheeseHistorySection,
  QuickLinksSection,
  ToolCard 
} from "@/components/home";

const tools = [
  {
    emoji: "⚡",
    title: "CHEESE",
    titleHighlight: "Up",
    description: "Powered by the CHEESEPOWERZ smart contract CHEESEUp allows $CHEESE holders to power-up CPU and NET with $CHEESE. The $CHEESE is sent to eosio.null and leaves circulation forever",
    linkTo: "/powerup",
    buttonLabel: "Go to CHEESEUp",
  },
  {
    emoji: "🧀",
    title: "CHEESE",
    titleHighlight: "Faucet",
    description: "Powered by the CHEESEFAUCET and CHEESECHEESE smart contracts, Hosted on GitHub users stake their $CHEESE to claim mine $CHEESE at a high APR",
    externalLink: "https://cheeseonwax.github.io/tools/cheesefaucet.html",
    buttonLabel: "Go to CHEESEFaucet",
  },
  {
    emoji: "🏛️",
    title: "CHEESE",
    titleHighlight: "Dao",
    description: "Powered by the DAO.WAXDAO and CHEESEFEEFEE smart contracts and acting as an alternate Front-End CHEESEDao allows all WAX users to create DAOs and vote on Governance Proposals",
    linkTo: "/dao",
    buttonLabel: "Go to CHEESEDao",
  },
  {
    emoji: "🌱",
    title: "CHEESE",
    titleHighlight: "Farm",
    description: "Powered by the FARMS.WAXDAO and CHEESEFEEFEE smart contracts and acting as an alternate Front-End CHEESEFarm allows all WAX users to create and participate in V2 non-custodial NFT staking farms",
    linkTo: "/farm",
    buttonLabel: "Go to CHEESEFarm",
  },
  {
    emoji: "🔐",
    title: "CHEESE",
    titleHighlight: "Lock",
    description: "Powered by the WAXDAOLOCKER smart contract and acting as an alternate Front-End CHEESELock allows all WAX users to time-lock tokens and/or LP tokens",
    linkTo: "/locker",
    buttonLabel: "Go to CHEESELock",
  },
  {
    emoji: "💧",
    title: "CHEESE",
    titleHighlight: "Drop",
    description: "Powered by the NFTHIVEDROP smart contract and acting as an alternate Front-End CHEESEDrop allows all WAX users to create NFT drops and sell them for various WAX tokens",
    linkTo: "/drops",
    buttonLabel: "Go to CHEESEDrop",
  },
  {
    emoji: "👛",
    title: "CHEESE",
    titleHighlight: "Wallet",
    description: "A simple, clean wallet UI. Send tokens OR NFTs. Stake WAX for resources. Rent CPU and NET. Buy and sell RAM. Vote for Block Producers or nominate a Proxy. Claim vote rewards.",
    highlight: "+ Manage Alcor LP Farm Positions",
    buttonLabel: "Open Wallet",
    onClick: () => window.dispatchEvent(new CustomEvent('open-cheese-wallet')),
  },
  {
    emoji: "🎧",
    title: "CHEESE",
    titleHighlight: "Amp",
    description: "A simple, clean NFT music player that populates a list automatically with your music NFTS. Play videos, create playlists, shuffle tracks and enjoy your musical blockchain assets like never before. Minimizes to mini player and keeps playing while you work or browse the web",
    buttonLabel: "Open CHEESEAmp",
    onClick: () => window.dispatchEvent(new CustomEvent('open-cheese-amp')),
  },
  {
    emoji: "⛔",
    title: "CHEESE",
    titleHighlight: "Null",
    description: "Null $CHEESE, collateralize xCHEESE and fund CHEESEUp. A dapp for pure CHEESELovers increasing your share of supply, increasing the backing of xCHEESE and funding CHEESEUp CPU rentals",
    linkTo: "/cheesenull",
    buttonLabel: "Go to CHEESENull",
  },
  {
    emoji: "💧",
    title: "CHEESE",
    titleHighlight: "Drip",
    description: "Create automated slow-drip token payments. Set up trustless payroll, vesting schedules, or recurring payments on WAX. Powered by the WAXDAOESCROW smart contract",
    linkTo: "/drip",
    buttonLabel: "Go to CHEESEDrip",
  },
];

const Index = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cheese/5 via-transparent to-cheese-dark/5" />
        <div className="container relative py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            {/* Floating Bubble */}
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

            {/* Price Bar */}
            <div className="mt-8">
              <CheesePriceBar />
            </div>
          </div>
        </div>
      </section>

      {/* Token Stats Banner */}
      <section className="container py-8">
        <TokenStatsBanner />
      </section>

      {/* Quick Links */}
      <section className="container pb-8">
        <QuickLinksSection />
      </section>

      {/* CHEESETools Section */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Tools</span>
          </h2>
        </div>

        {/* Grid of tools - 4x2 layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {tools.map((tool, index) => (
            <ToolCard key={index} {...tool} />
          ))}
        </div>
      </section>

      {/* History Section */}
      <section className="container py-16">
        <div className="max-w-2xl mx-auto">
          <CheeseHistorySection />
        </div>
      </section>
    </Layout>
  );
};

export default Index;
