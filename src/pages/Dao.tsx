import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowseDaos } from "@/components/dao/BrowseDaos";
import { CreateDao } from "@/components/dao/CreateDao";
import { MyDaos } from "@/components/dao/MyDaos";
import { DaoDetail } from "@/components/dao/DaoDetail";

import cheeseDaoOrb from "@/assets/cheesedao.png";
import { playRandomFart } from "@/lib/fartSounds";

const Dao = () => {
  const { daoName } = useParams<{ daoName?: string }>();
  const navigate = useNavigate();

  if (daoName) {
    return (
      <Layout>
        <div className="container py-8">
          <DaoDetail daoName={daoName} onBack={() => navigate("/dao")} />
        </div>
      </Layout>
    );
  }

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
              <img src={cheeseDaoOrb} alt="CHEESE DAO" className="w-24 h-24 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <OpenMojiIcon emoji="" size={24} className="text-2xl" />
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Dao</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <OpenMojiIcon emoji="" size={24} className="text-2xl" />
              </div>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
                Create and Manage DAOs (Decentralized Autonomous Organizations) on WAX Utilizing WAXDAOs Battle Tested Smart Contract. Propose, Vote, Govern and Manage Token and NFT Treasuries with On-Chain Transparency.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12">
        {/* Compact centered tab bar */}
        <Tabs defaultValue="browse" className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="bg-card/80 border border-border/50 h-10">
              <TabsTrigger value="browse" className="gap-1.5 text-sm px-4">
                <OpenMojiIcon emoji="" size={14} className="text-sm" /> Browse DAOs
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-1.5 text-sm px-4">
                <OpenMojiIcon emoji="" size={14} className="text-sm" /> Create DAO
              </TabsTrigger>
              <TabsTrigger value="my-daos" className="gap-1.5 text-sm px-4">
                <OpenMojiIcon emoji="" size={14} className="text-sm" /> My DAOs
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="browse">
            <BrowseDaos />
          </TabsContent>
          <TabsContent value="create">
            <CreateDao />
          </TabsContent>
          <TabsContent value="my-daos">
            <MyDaos />
          </TabsContent>
        </Tabs>

        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>
            Powered by{" "}
            <a href="https://waxblock.io/account/dao.waxdao" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
              DAO.WAXDAO
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

export default Dao;
