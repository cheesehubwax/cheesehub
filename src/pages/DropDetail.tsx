import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShoppingCart, Info } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { fetchDropById } from "@/services/atomicApi";
import { useWax } from "@/context/WaxContext";
import { useCart } from "@/context/CartContext";
import { useDropEligibility } from "@/hooks/useDropEligibility";
import { getTokenConfig } from "@/lib/tokenRegistry";
import type { NFTDrop, SelectedPrice } from "@/types/drop";

const DropDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { isConnected, accountName } = useWax();
  const { addToCart } = useCart();
  const [drop, setDrop] = useState<NFTDrop | null>(null);
  const [loading, setLoading] = useState(true);
  const { eligibility } = useDropEligibility(drop, accountName || undefined);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDropById(id).then(data => {
      setDrop(data);
      setLoading(false);
    });
  }, [id]);

  const handleAddToCart = () => {
    if (!drop) return;
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

  if (loading) {
    return (
      <Layout>
        <div className="container py-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!drop) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground mb-4">Drop not found</p>
          <Button asChild variant="ghost">
            <Link to="/drops"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Drops</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const isFree = drop.isFree || drop.price === 0;
  const isOutOfStock = drop.remaining <= 0 && drop.totalSupply > 0;

  return (
    <Layout>
      <div className="container py-8">
        <Button asChild variant="ghost" className="mb-6">
          <Link to="/drops"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Drops</Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <Card className="bg-card/80 border-border/50 overflow-hidden">
            <div className="aspect-square">
              <img
                src={drop.image || "/placeholder.svg"}
                alt={drop.name}
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
              />
            </div>
          </Card>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">{drop.collectionName}</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-1">{drop.name}</h1>
            </div>

            {drop.description && (
              <p className="text-muted-foreground">{drop.description}</p>
            )}

            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price</span>
                  {isFree ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">FREE</Badge>
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {drop.price.toLocaleString()} {drop.currency || "CHEESE"}
                    </span>
                  )}
                </div>

                {drop.totalSupply > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Supply</span>
                    <span className="font-medium">{drop.remaining} / {drop.totalSupply} remaining</span>
                  </div>
                )}

                {drop.seller && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Seller</span>
                    <span className="font-mono text-sm">{drop.seller}</span>
                  </div>
                )}

                {!eligibility.isEligible && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <Info className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-sm text-destructive">{eligibility.reason}</p>
                  </div>
                )}

                {isOutOfStock ? (
                  <Badge variant="secondary" className="w-full justify-center py-2">Sold Out</Badge>
                ) : (
                  <Button
                    className="w-full bg-primary text-primary-foreground"
                    size="lg"
                    onClick={handleAddToCart}
                    disabled={!eligibility.isEligible}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {isFree ? "Claim Free Drop" : "Add to Cart"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Attributes */}
            {drop.attributes && drop.attributes.length > 0 && (
              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Attributes</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {drop.attributes.map((attr, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <p className="text-xs text-muted-foreground">{attr.trait}</p>
                        <p className="text-sm font-medium truncate">{attr.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DropDetail;
