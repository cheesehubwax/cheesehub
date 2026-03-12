import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowseDaos } from "@/components/dao/BrowseDaos";
import { CreateDao } from "@/components/dao/CreateDao";
import { MyDaos } from "@/components/dao/MyDaos";
import { DaoDetail } from "@/components/dao/DaoDetail";
import cheeseLogo2 from "@/assets/cheese-logo-2.png";
import { playRandomFart } from "@/lib/fartSounds";

const Dao = () => {
  const [selectedDao, setSelectedDao] = useState<string | null>(null);

  if (selectedDao) {
    return (
      <Layout>
        <div className="container py-8">
          <DaoDetail daoName={selectedDao} onBack={() => setSelectedDao(null)} />
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
              <img src={cheeseLogo2} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Dao</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Create and participate in DAOs on the WAX blockchain using the WaxDAO smart contracts.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12">
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              DAO Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="browse" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="browse">Browse DAOs</TabsTrigger>
                <TabsTrigger value="create">Create DAO</TabsTrigger>
                <TabsTrigger value="my-daos">My DAOs</TabsTrigger>
              </TabsList>
              <TabsContent value="browse" className="mt-6">
                <BrowseDaos onSelectDao={setSelectedDao} />
              </TabsContent>
              <TabsContent value="create" className="mt-6">
                <CreateDao />
              </TabsContent>
              <TabsContent value="my-daos" className="mt-6">
                <MyDaos onSelectDao={setSelectedDao} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

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
