import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLock } from "@/components/locker/CreateLock";
import { MyLocks } from "@/components/locker/MyLocks";
import { CreateLiquidityLock } from "@/components/locker/CreateLiquidityLock";
import { MyLiquidityLocks } from "@/components/locker/MyLiquidityLocks";
import cheeseLockOrb from "@/assets/cheeselock.png";
import { playRandomFart } from "@/lib/fartSounds";

const Locker = () => {
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
              <img src={cheeseLockOrb} alt="CHEESE Lock" className="w-24 h-24 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">🔐</span>
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Lock</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <span className="text-2xl">🔐</span>
              </div>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Time-lock tokens and LP tokens using the WaxDAO Locker smart contract.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12">
        <Tabs defaultValue="create" className="w-full max-w-xl mx-auto">
          <div className="flex justify-center mb-6">
            <TabsList className="bg-card/80 border border-border/50 h-10">
              <TabsTrigger value="create" className="gap-1.5 text-sm px-4">Create Lock</TabsTrigger>
              <TabsTrigger value="my-locks" className="gap-1.5 text-sm px-4">My Locks</TabsTrigger>
              <TabsTrigger value="lp-lock" className="gap-1.5 text-sm px-4">LP Lock</TabsTrigger>
              <TabsTrigger value="my-lp" className="gap-1.5 text-sm px-4">My LP Locks</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="create">
            <CreateLock />
          </TabsContent>
          <TabsContent value="my-locks">
            <MyLocks />
          </TabsContent>
          <TabsContent value="lp-lock">
            <CreateLiquidityLock />
          </TabsContent>
          <TabsContent value="my-lp">
            <MyLiquidityLocks />
          </TabsContent>
        </Tabs>

        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>
            Powered by{" "}
            <a href="https://waxblock.io/account/waxdaolocker" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
              WAXDAOLOCKER
            </a>{" "}
            smart contract
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Locker;
