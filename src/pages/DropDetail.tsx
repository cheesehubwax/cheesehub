import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShoppingCart, Info } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { fetchDropById } from "@/services/atomicApi";
import { useWax } from "@/context/WaxContext";
import { useCart } from "@/context/CartContext";
import { useDropEligibility } from "@/hooks/useDropEligibility";
import { getTokenConfig } from "@/lib/tokenRegistry";
import { getTokenContract } from "@/lib/tokenLogos";
import type { NFTDrop, SelectedPrice } from "@/types/drop";

const DropDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { isConnected, accountName } = useWax();
  const { addToCart } = useCart();
  const [drop, setDrop] = useState<NFTDrop | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const { eligibility } = useDropEligibility(drop, accountName || undefined);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDropById(id).then(data => {
      setDrop(data);
      setLoading(false);
    });
  }, [id]);

  // Auto-select if only one price option
  useEffect(() => {
    if (!drop) return;
    const prices = drop.prices && drop.prices.length > 0 ? drop.prices : [];
    if (prices.length === 1) {
      setSelectedPriceIndex(0);
    } else if (prices.length === 0) {
      setSelectedPriceIndex(-1); // use legacy single price
    } else {
      setSelectedPriceIndex(null);
    }
  }, [drop]);

  function getContractForCurrency(currency: string): string {
    const config = getTokenConfig(currency);
    if (config) return config.contract;
    const alcorContract = getTokenContract(currency);
    if (alcorContract) return alcorContract;
    return 'eosio.token';
  }

  const handleAddToCart = () => {
    if (!drop) return;
    const prices = drop.prices && drop.prices.length > 0 ? drop.prices : [];

    let currency: string;
    let price: number;
    let listingPrice: string | undefined;

    if (selectedPriceIndex !== null && selectedPriceIndex >= 0 && prices[selectedPriceIndex]) {
      const p = prices[selectedPriceIndex];
      currency = p.currency;
      price = p.price;
      listingPrice = p.listingPrice;
    } else {
      currency = drop.currency || "CHEESE";
      price = drop.price;
      listingPrice = drop.listingPrice;
    }

    const config = getTokenConfig(currency);
    const contract = config?.contract || getContractForCurrency(currency);
    const precision = config?.precision || 8;
    const selectedPrice: SelectedPrice = {
      price,
      currency,
      tokenContract: contract,
      precision,
      listingPrice: listingPrice || `${price.toFixed(precision)} ${currency}`,
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
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">{drop.collectionName}</p>
                <Badge variant={drop.templateId ? "default" : "secondary"} className="text-xs">
                  {drop.templateId ? 'Mint on Demand' : 'Pre-mint'}
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-1">{drop.name}</h1>
            </div>

            {drop.description && (
              <p className="whitespace-pre-line text-muted-foreground">{drop.description}</p>
            )}

            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price</span>
                  {isFree ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">FREE</Badge>
                  ) : drop.prices && drop.prices.length > 1 ? (
                    <span className="text-sm text-muted-foreground">{drop.prices.length} payment options</span>
                  ) : (
                    <span className="text-lg font-bold text-primary flex items-center gap-2">
                      <TokenLogo
                        contract={getTokenConfig(drop.currency || "CHEESE")?.contract || "cheeseburger"}
                        symbol={drop.currency || "CHEESE"}
                        size="md"
                      />
                      {drop.price.toLocaleString()} {drop.currency || "CHEESE"}
                    </span>
                  )}
                </div>

                {/* Payment options with checkboxes */}
                {!isFree && drop.prices && drop.prices.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-sm text-muted-foreground">Select payment method</span>
                    {drop.prices.map((p, i) => (
                      <label
                        key={i}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedPriceIndex === i
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-muted/30 border-border/30 hover:border-border/60'
                        }`}
                        onClick={() => setSelectedPriceIndex(i)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedPriceIndex === i}
                            onCheckedChange={() => setSelectedPriceIndex(i)}
                          />
                          <TokenLogo
                            contract={getContractForCurrency(p.currency)}
                            symbol={p.currency}
                            size="md"
                          />
                          <span className="font-medium text-foreground">{p.currency}</span>
                        </div>
                        <span className="font-bold text-primary">{p.price.toLocaleString()}</span>
                      </label>
                    ))}
                  </div>
                )}

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
                    disabled={!eligibility.isEligible || (!isFree && drop.prices && drop.prices.length > 1 && selectedPriceIndex === null)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {isFree ? "Claim Free Drop" : selectedPriceIndex === null && drop.prices && drop.prices.length > 1 ? "Select Payment First" : "Add to Cart"}
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
