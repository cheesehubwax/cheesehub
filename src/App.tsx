import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { WaxProvider } from "@/context/WaxContext";
import Index from "./pages/Index";
import PowerUp from "./pages/PowerUp";
import Locker from "./pages/Locker";
import Drops from "./pages/Drops";
import DropDetail from "./pages/DropDetail";
import Dao from "./pages/Dao";
import Farm from "./pages/Farm";
import CheeseNull from "./pages/CheeseNull";
import Drip from "./pages/Drip";
import BannerAds from "./pages/BannerAds";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Apply dark class to html element for portals (dialogs, popovers, etc.)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WaxProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/powerup" element={<PowerUp />} />
                <Route path="/locker" element={<Locker />} />
                <Route path="/drops" element={<Drops />} />
                <Route path="/drops/:id" element={<DropDetail />} />
                <Route path="/dao" element={<Dao />} />
                <Route path="/farm" element={<Farm />} />
                <Route path="/farm/:farmName" element={<Farm />} />
                <Route path="/cheesenull" element={<CheeseNull />} />
                <Route path="/drip" element={<Drip />} />
                <Route path="/bannerads" element={<BannerAds />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </WaxProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
