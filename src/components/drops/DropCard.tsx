import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { getTokenConfig } from "@/lib/tokenRegistry";
import type { NFTDrop } from "@/types/drop";

interface DropCardProps {
  drop: NFTDrop;
  onAddToCart?: (drop: NFTDrop) => void;
  onClick?: (drop: NFTDrop) => void;
}

export function DropCard({ drop, onAddToCart, onClick }: DropCardProps) {
  const isFree = drop.isFree || drop.price === 0;
  const isOutOfStock = drop.remaining <= 0 && drop.totalSupply > 0;

  return (
    <Card
      className="bg-card/80 border-border/50 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
      onClick={() => onClick?.(drop)}
    >
      <div className="aspect-square overflow-hidden bg-muted/30">
        <img
          src={drop.image || "/placeholder.svg"}
          alt={drop.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          loading="lazy"
        />
      </div>
      <CardContent className="p-3 space-y-2">
        <h3 className="font-semibold text-sm text-foreground truncate">{drop.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{drop.collectionName}</p>

        <div className="flex items-center justify-between">
          <div>
            {isFree ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">FREE</Badge>
            ) : (
              <span className="text-sm font-semibold text-primary">
                {drop.price.toLocaleString()} {drop.currency || "CHEESE"}
              </span>
            )}
          </div>
          {drop.totalSupply > 0 && (
            <span className="text-xs text-muted-foreground">
              {drop.remaining}/{drop.totalSupply}
            </span>
          )}
        </div>

        {isOutOfStock ? (
          <Badge variant="secondary" className="w-full justify-center">Sold Out</Badge>
        ) : (
          onAddToCart && (
            <Button
              size="sm"
              className="w-full bg-primary text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(drop);
              }}
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              {isFree ? "Claim" : "Add to Cart"}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
