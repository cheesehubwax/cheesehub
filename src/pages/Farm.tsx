import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams } from "react-router-dom";
import { BrowseFarms } from "@/components/farm/BrowseFarms";
import { CreateFarm } from "@/components/farm/CreateFarm";
import { MyFarms } from "@/components/farm/MyFarms";
import { FarmDetail } from "@/components/farm/FarmDetail";
import cheeseLogo2 from "@/assets/cheese-logo-2.png";
import { playRandomFart } from "@/lib/fartSounds";

const Farm = () => {
  const { farmName: routeFarmName } = useParams<{ farmName?: string }>();
  const [selectedFarm, setSelectedFarm] = useState<string | null>(routeFarmName || null);

  if (selectedFarm) {
    return (
      <Layout>
        <div className="container py-8">
          <FarmDetail farmName={selectedFarm} onBack={() => setSelectedFarm(null)} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-6">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseDropOrb} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Farm</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Create and participate in non-custodial NFT staking farms using the WaxDAO V2 smart contracts.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12">
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-primary" />
              NFT Staking Farms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="browse" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="browse">Browse Farms</TabsTrigger>
                <TabsTrigger value="create">Create Farm</TabsTrigger>
                <TabsTrigger value="my-farms">My Farms</TabsTrigger>
              </TabsList>
              <TabsContent value="browse" className="mt-6">
                <BrowseFarms onSelectFarm={setSelectedFarm} />
              </TabsContent>
              <TabsContent value="create" className="mt-6">
                <CreateFarm />
              </TabsContent>
              <TabsContent value="my-farms" className="mt-6">
                <MyFarms onSelectFarm={setSelectedFarm} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>
            Powered by{" "}
            <a href="https://waxblock.io/account/farms.waxdao" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
              FARMS.WAXDAO
            </a>{" "}
            &{" "}
            <a href="https://waxblock.io/account/cheesefeefee" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
              CHEESEFEEFEE
            </a>{" "}
            smart contracts
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Farm;
