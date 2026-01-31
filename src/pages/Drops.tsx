import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Drops = () => {
  return (
    <Layout>
      <div className="container py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Drop</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Browse and purchase NFT drops, or create your own drops using the NFTHive smart contract.
          </p>
        </div>

        <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-cheese" />
              NFT Drops Marketplace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="browse" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="browse">Browse Drops</TabsTrigger>
                <TabsTrigger value="create">Create Drop</TabsTrigger>
                <TabsTrigger value="my-drops">My Drops</TabsTrigger>
              </TabsList>
              <TabsContent value="browse" className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                  <ShoppingBag className="h-8 w-8 text-cheese" />
                </div>
                <p className="text-muted-foreground">
                  NFT drops will be displayed here...
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Loading drops from NFTHive and AtomicHub
                </p>
              </TabsContent>
              <TabsContent value="create" className="text-center py-12">
                <p className="text-muted-foreground">
                  Create drop functionality coming soon...
                </p>
              </TabsContent>
              <TabsContent value="my-drops" className="text-center py-12">
                <p className="text-muted-foreground">
                  Your created drops will appear here...
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Drops;
