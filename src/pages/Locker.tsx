import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
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
      {/* Hero */}
      <section className="container py-12 md:py-20">
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
                <span className="text-2xl">🔐</span>
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Time-lock tokens and LP tokens using the WaxDAO Locker smart contract.
              </p>
          </div>
        </div>
      </section>

      <div className="container pb-12">
        <Card className="max-w-4xl mx-auto bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Token Locker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                <TabsTrigger value="create" className="text-xs sm:text-sm">Create Lock</TabsTrigger>
                <TabsTrigger value="my-locks" className="text-xs sm:text-sm">My Locks</TabsTrigger>
                <TabsTrigger value="lp-lock" className="text-xs sm:text-sm">LP Lock</TabsTrigger>
                <TabsTrigger value="my-lp" className="text-xs sm:text-sm">My LP Locks</TabsTrigger>
              </TabsList>
              <TabsContent value="create" className="mt-6">
                <CreateLock />
              </TabsContent>
              <TabsContent value="my-locks" className="mt-6">
                <MyLocks />
              </TabsContent>
              <TabsContent value="lp-lock" className="mt-6">
                <CreateLiquidityLock />
              </TabsContent>
              <TabsContent value="my-lp" className="mt-6">
                <MyLiquidityLocks />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

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
