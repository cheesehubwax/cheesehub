import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { NullStats } from '@/components/cheesenull/NullStats';
import { NullButton } from '@/components/cheesenull/NullButton';
import { NullTotalStats } from '@/components/cheesenull/NullTotalStats';
import { NullerLeaderboard } from '@/components/cheesenull/NullerLeaderboard';
import { useNullerLeaderboard } from '@/hooks/useNullerLeaderboard';
import cheeseNullLogo from '@/assets/cheesenull-orb.png';
import { playRandomFart } from '@/lib/fartSounds';

export default function CheeseNull() {
  const [canClaim, setCanClaim] = useState(false);
  const { rawActions, isLoading: lbLoading, isError: lbError, refetch: refetchLeaderboard } = useNullerLeaderboard();

  const handleBurnSuccess = () => {
    refetchLeaderboard();
  };

  return (
    <Layout>
      <section className="container py-12 md:py-20">
        <div className="flex flex-col items-center gap-8">
          {/* Floating Cheese Orb */}
          <div
            className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
            onClick={playRandomFart}
          >
            <img src={cheeseNullLogo} alt="CHEESE Null" className="w-24 h-24 object-contain" />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">⛔</span>
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Null</span>
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
              <span className="text-2xl">⛔</span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Null $CHEESE, collateralize xCHEESE and fund CHEESEUp. A dapp for pure CHEESELovers increasing your share of supply, increasing the backing of xCHEESE and funding CHEESEUp CPU rentals
            </p>
          </div>

          {/* Stats */}
          <NullStats onCanClaimChange={setCanClaim} />

          {/* Button */}
          <NullButton disabled={!canClaim} onBurnSuccess={handleBurnSuccess} />

          {/* Total Stats */}
          <NullTotalStats />

          {/* Leaderboard */}
          <NullerLeaderboard rawActions={rawActions} isLoading={lbLoading} isError={lbError} onRefresh={() => refetchLeaderboard()} />

          {/* Powered by */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Powered by the{" "}
              <a
                href="https://waxblock.io/account/cheeseburner"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cheese hover:text-cheese-dark underline transition-colors"
              >
                CHEESEBURNER
              </a>{" "}
              smart contract.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
