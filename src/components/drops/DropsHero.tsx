import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, TrendingUp } from "lucide-react";

interface DropsHeroProps {
  totalDrops: number;
  totalSales: number;
}

export function DropsHero({ totalDrops, totalSales }: DropsHeroProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <Card className="bg-card/60 border-border/40">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalDrops}</p>
            <p className="text-xs text-muted-foreground">Active Drops</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card/60 border-border/40">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalSales}</p>
            <p className="text-xs text-muted-foreground">Market Sales</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
