import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Dao = () => {
  return (
    <Layout>
      <div className="container py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Dao</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Create and participate in DAOs on the WAX blockchain using the WaxDAO smart contracts.
          </p>
        </div>

        <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cheese" />
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
              <TabsContent value="browse" className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                  <Users className="h-8 w-8 text-cheese" />
                </div>
                <p className="text-muted-foreground">
                  DAOs will be displayed here...
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Loading DAOs from WaxDAO
                </p>
              </TabsContent>
              <TabsContent value="create" className="text-center py-12">
                <p className="text-muted-foreground">
                  Create DAO functionality coming soon...
                </p>
              </TabsContent>
              <TabsContent value="my-daos" className="text-center py-12">
                <p className="text-muted-foreground">
                  Your DAOs will appear here...
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dao;
