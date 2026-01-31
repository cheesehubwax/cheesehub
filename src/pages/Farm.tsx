import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams } from "react-router-dom";

const Farm = () => {
  const { farmName } = useParams<{ farmName?: string }>();

  // If a specific farm is selected, show farm detail
  if (farmName) {
    return (
      <Layout>
        <div className="container py-8">
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-cheese" />
                Farm: {farmName}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Farm details for "{farmName}" will be displayed here...
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Farm</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Create and participate in non-custodial NFT staking farms using the WaxDAO V2 smart contracts.
          </p>
        </div>

        <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-cheese" />
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
              <TabsContent value="browse" className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                  <Sprout className="h-8 w-8 text-cheese" />
                </div>
                <p className="text-muted-foreground">
                  NFT staking farms will be displayed here...
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Loading farms from WaxDAO
                </p>
              </TabsContent>
              <TabsContent value="create" className="text-center py-12">
                <p className="text-muted-foreground">
                  Create farm functionality coming soon...
                </p>
              </TabsContent>
              <TabsContent value="my-farms" className="text-center py-12">
                <p className="text-muted-foreground">
                  Your farms will appear here...
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Farm;
