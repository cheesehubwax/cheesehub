import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

const PowerUp = () => {
  return (
    <Layout>
      <div className="container py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Up</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Power up CPU and NET resources using $CHEESE. The tokens are permanently burned, leaving circulation forever.
          </p>
        </div>

        <Card className="max-w-2xl mx-auto bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-cheese" />
              PowerUp Interface
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
              <Zap className="h-8 w-8 text-cheese" />
            </div>
            <p className="text-muted-foreground">
              PowerUp functionality coming soon...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Connect your wallet to power up resources with CHEESE
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PowerUp;
