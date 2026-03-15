import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams, useNavigate } from "react-router-dom";
import { BrowseFarms } from "@/components/farm/BrowseFarms";
import { CreateFarm } from "@/components/farm/CreateFarm";
import { MyFarms } from "@/components/farm/MyFarms";
import { FarmDetail } from "@/components/farm/FarmDetail";
import cheeseFarmLogo from "@/assets/cheesefarm.png";
import { playRandomFart } from "@/lib/fartSounds";
import { Search, FolderOpen, Plus } from "lucide-react";

const Farm = () => {
  const { farmName } = useParams<{ farmName?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("browse");

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
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-28 w-28 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseFarmLogo} alt="CHEESEFarm" className="w-28 h-28 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Farm</span>
                </h1>
                <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                  BETA
                </Badge>
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Create and participate in non-custodial NFT staking farms using the WaxDAO V2 smart contracts.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="bg-card/80 border border-border/50 h-10">
              <TabsTrigger value="browse" className="gap-1.5 text-sm px-4">
                <Search className="h-4 w-4" /> Browse Farms
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-1.5 text-sm px-4">
                <Plus className="h-4 w-4" /> Create Farm
              </TabsTrigger>
              <TabsTrigger value="my-farms" className="gap-1.5 text-sm px-4">
                <FolderOpen className="h-4 w-4" /> My Farms
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
