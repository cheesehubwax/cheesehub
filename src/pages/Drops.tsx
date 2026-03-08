import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Search, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDropsLoader } from "@/hooks/useDropsLoader";
import { useEnrichDrops } from "@/hooks/useEnrichDrops";
import { useCart } from "@/context/CartContext";
import { DropCard } from "@/components/drops/DropCard";
import { DropsHero } from "@/components/drops/DropsHero";
import { CartDrawer } from "@/components/drops/CartDrawer";
import { useNavigate } from "react-router-dom";
import { getTokenConfig } from "@/lib/tokenRegistry";
import type { NFTDrop, SelectedPrice } from "@/types/drop";
import cheeseDropOrb from "@/assets/cheesedrop.png";
import { playRandomFart } from "@/lib/fartSounds";

const Drops = () => {
  const { drops, sales, loading, error } = useDropsLoader();
  const { enrichedDrops } = useEnrichDrops(drops);
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredDrops = search.trim()
    ? enrichedDrops.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.collectionName.toLowerCase().includes(search.toLowerCase())
      )
    : enrichedDrops;

  const filteredSales = search.trim()
    ? sales.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.collectionName.toLowerCase().includes(search.toLowerCase())
      )
    : sales;

  const handleAddToCart = (drop: NFTDrop) => {
    const currency = drop.currency || "CHEESE";
    const config = getTokenConfig(currency);
    const selectedPrice: SelectedPrice = {
      price: drop.price,
      currency,
      tokenContract: config?.contract || "cheeseburger",
      precision: config?.precision || 4,
      listingPrice: drop.listingPrice || `${drop.price.toFixed(config?.precision || 4)} ${currency}`,
    };
    addToCart(drop, selectedPrice);
  };

  const handleDropClick = (drop: NFTDrop) => {
    if (drop.dropId) {
      navigate(`/drops/${drop.dropId}`);
    }
  };

  return (
    <Layout>
      <CartDrawer />

      {/* Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-6">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseDropOrb} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Drop</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Browse and purchase NFT drops, or create your own drops using the NFTHive smart contract.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12">
        <DropsHero totalDrops={enrichedDrops.length} totalSales={sales.length} />

        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                NFT Marketplace
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drops..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="drops" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="drops">Drops ({filteredDrops.length})</TabsTrigger>
                <TabsTrigger value="sales">Market Sales ({filteredSales.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="drops" className="mt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <p className="text-center text-destructive py-8">{error}</p>
                ) : filteredDrops.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No drops found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredDrops.map(drop => (
                      <DropCard
                        key={drop.id}
                        drop={drop}
                        onAddToCart={handleAddToCart}
                        onClick={handleDropClick}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sales" className="mt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No market sales found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredSales.map(sale => (
                      <DropCard key={sale.id} drop={sale} onAddToCart={handleAddToCart} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>
            Powered by{" "}
            <a href="https://waxblock.io/account/nfthivedrops" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
              NFTHIVEDROPS
            </a>{" "}
            smart contract
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Drops;
