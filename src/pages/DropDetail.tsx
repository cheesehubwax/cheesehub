import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const DropDetail = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <Layout>
      <div className="container py-8">
        <Button asChild variant="ghost" className="mb-4">
          <Link to="/drops">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Drops
          </Link>
        </Button>

        <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
          <CardContent className="py-12 text-center">
            <h1 className="text-2xl font-bold mb-4">Drop #{id}</h1>
            <p className="text-muted-foreground">
              Drop details will be displayed here...
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DropDetail;
