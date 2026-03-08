import { Layout } from "@/components/Layout";
import { PowerUpCard } from "@/components/powerup/PowerUpCard";
import { PowerupStatsBar } from "@/components/powerup/PowerupStatsBar";
import { useWax } from "@/context/WaxContext";
import { usePowerupStats } from "@/hooks/usePowerupStats";
import { usePowerupLeaderboard } from "@/hooks/usePowerupLeaderboard";
import { PowerupLeaderboard } from "@/components/powerup/PowerupLeaderboard";
import cheeseDropOrb from "@/assets/cheesedrop.png";
import { playRandomFart } from "@/lib/fartSounds";

const PowerUp = () => {
  const { isConnected, accountName, isLoading, session, cheeseBalance, login, logout, refreshBalance } = useWax();
  const { stats, isLoading: statsLoading, refetch: refetchStats } = usePowerupStats();
  const { rawActions, isLoading: lbLoading, isError: lbError, refetch: refetchLeaderboard } = usePowerupLeaderboard();

  const handleConnectWallet = async () => {
    if (isConnected) {
      await logout();
    } else {
      await login();
    }
  };

  return (
    <Layout>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
           <div className="flex flex-col items-center gap-8">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseDropOrb} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">⚡</span>
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Up</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <span className="text-2xl">⚡</span>
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Power Up your CPU and NET resources using $CHEESE. The $CHEESE is sent to eosio.null and leaves circulation forever
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12 flex flex-col items-center gap-8">

        <PowerUpCard
          walletConnected={isConnected}
          onConnectWallet={handleConnectWallet}
          session={session}
          accountName={accountName}
          cheeseBalance={cheeseBalance}
          onBalanceRefresh={refreshBalance}
          onStatsRefresh={refetchStats}
        />

        <PowerupLeaderboard rawActions={rawActions} isLoading={lbLoading} isError={lbError} onRefresh={() => refetchLeaderboard()} />

        <PowerupStatsBar stats={stats} isLoading={statsLoading} />

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Powered by the{" "}
            <a
              href="https://waxblock.io/account/cheesepowerz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cheese hover:underline"
            >
              CHEESEPOWERZ
            </a>{" "}
            smart contract.
          </p>
        </div>
      </main>
    </Layout>
  );
};

export default PowerUp;
