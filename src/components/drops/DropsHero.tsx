import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";

interface DropsHeroProps {
  totalDrops: number;
}

export function DropsHero({ totalDrops }: DropsHeroProps) {
  return (
    <div className="mb-6">
      <Card className="bg-card/60 border-border/40 max-w-xs">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalDrops}</p>
            <p className="text-xs text-muted-foreground">Active Official Drops</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
