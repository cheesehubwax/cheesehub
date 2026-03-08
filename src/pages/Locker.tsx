import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLock } from "@/components/locker/CreateLock";
import { MyLocks } from "@/components/locker/MyLocks";
import { CreateLiquidityLock } from "@/components/locker/CreateLiquidityLock";
import { MyLiquidityLocks } from "@/components/locker/MyLiquidityLocks";
import cheeseDropOrb from "@/assets/cheesedrop.png";
import { playRandomFart } from "@/lib/fartSounds";

const Locker = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-6">
            <div className="h-24 w-24 animate-float cheese-glow rounded-full flex items-center justify-center">
              <img src={cheeseLogo} alt="CHEESE" className="w-20 h-20 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Lock</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Time-lock tokens and LP tokens using the WaxDAO Locker smart contract.
              </p>
            </div>
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="create">Create Lock</TabsTrigger>
                <TabsTrigger value="my-locks">My Locks</TabsTrigger>
                <TabsTrigger value="lp-lock">LP Lock</TabsTrigger>
                <TabsTrigger value="my-lp">My LP Locks</TabsTrigger>
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
