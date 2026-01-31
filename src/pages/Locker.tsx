import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Locker = () => {
  return (
    <Layout>
      <div className="container py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Lock</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Time-lock tokens and LP tokens using the WaxDAO Locker smart contract.
          </p>
        </div>

        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-cheese" />
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
              <TabsContent value="create" className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                  <Lock className="h-8 w-8 text-cheese" />
                </div>
                <p className="text-muted-foreground">
                  Create Token Lock functionality coming soon...
                </p>
              </TabsContent>
              <TabsContent value="my-locks" className="text-center py-12">
                <p className="text-muted-foreground">
                  Your token locks will appear here...
                </p>
              </TabsContent>
              <TabsContent value="lp-lock" className="text-center py-12">
                <p className="text-muted-foreground">
                  Create LP Lock functionality coming soon...
                </p>
              </TabsContent>
              <TabsContent value="my-lp" className="text-center py-12">
                <p className="text-muted-foreground">
                  Your LP locks will appear here...
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Locker;
