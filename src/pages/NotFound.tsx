import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';


const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="container py-16 text-center">
        <div className="h-24 w-24 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-8">
          <OpenMojiIcon emoji="🧀" size={48} className="text-6xl" />
        </div>
        <h1 className="text-4xl font-bold mb-4">
          <span className="text-cheese">404</span>
          <span className="text-foreground"> - Page Not Found</span>
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Oops! Looks like this page has been eaten. The CHEESE you're looking for doesn't exist.
        </p>
        <Button asChild className="bg-cheese hover:bg-cheese-dark text-primary-foreground">
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>
    </Layout>
  );
};

export default NotFound;
