import { useState } from "react";
import { Layout } from "@/components/Layout";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams, useNavigate } from "react-router-dom";
import { BrowseFarms } from "@/components/farm/BrowseFarms";
import { CreateFarm } from "@/components/farm/CreateFarm";
import { MyFarms } from "@/components/farm/MyFarms";
import { FarmDetail } from "@/components/farm/FarmDetail";
import { FarmCard } from "@/components/farm/FarmCard";
import { fetchAllFarms } from "@/lib/farm";
import { useQuery } from "@tanstack/react-query";

import { playRandomFart } from "@/lib/fartSounds";
import { useWax } from "@/context/WaxContext";
import { useFarmClaimTotals } from "@/hooks/useFarmClaimTotals";


const Farm = () => {
  const { farmName } = useParams<{ farmName?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("browse");
  const { accountName } = useWax();
  const { totals: claimTotals } = useFarmClaimTotals(accountName);

  const { data: allFarms = [] } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchAllFarms,
    staleTime: 60_000,
    enabled: !farmName,
  });
  const featuredFarm = allFarms.find(f => f.farm_name === "cheesefarm");

  if (farmName) {
    return (
      <Layout>
        <div className="container py-8">
          <FarmDetail farmName={farmName} onBack={() => navigate("/farm")} />
        </div>
      </Layout>
    );
  }

  const handleCreateFarm = () => {
    setActiveTab("create");
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseFarmLogo} alt="CHEESEFarm" className="w-24 h-24 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <OpenMojiIcon emoji="🌱" size={24} className="text-2xl" />
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Farm</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <OpenMojiIcon emoji="🌱" size={24} className="text-2xl" />
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Create and participate in non-custodial NFT staking farms using the WaxDAO V2 smart contracts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {featuredFarm && (
        <div className="container pb-8 flex justify-center">
          <div className="w-full max-w-md">
            <p className="text-center text-cheese text-xs uppercase tracking-wider mb-3 flex items-center justify-center gap-1.5">
              <OpenMojiIcon emoji="⭐" size={14} />
              Featured Farm
            </p>
            <div className="rounded-xl p-[2px] bg-gradient-to-br from-cheese/60 via-cheese/20 to-cheese/60 shadow-[0_0_30px_-5px_hsl(var(--cheese)/0.4)]">
              <FarmCard farm={featuredFarm} userClaimed={claimTotals[featuredFarm.farm_name]} />
            </div>
          </div>
        </div>
      )}

      <div className="container pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="bg-card/80 border border-border/50 h-10">
              <TabsTrigger value="browse" className="gap-1.5 text-sm px-4">
                <OpenMojiIcon emoji="🔍" size={14} className="text-sm" /> Browse Farms
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-1.5 text-sm px-4">
                <OpenMojiIcon emoji="✍️" size={14} className="text-sm" /> Create Farm
              </TabsTrigger>
              <TabsTrigger value="my-farms" className="gap-1.5 text-sm px-4">
                <OpenMojiIcon emoji="📂" size={14} className="text-sm" /> My Farms
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="browse">
            <BrowseFarms />
          </TabsContent>
          <TabsContent value="my-farms">
            <MyFarms onCreateFarm={handleCreateFarm} />
          </TabsContent>
          <TabsContent value="create">
            <CreateFarm />
          </TabsContent>
        </Tabs>

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
