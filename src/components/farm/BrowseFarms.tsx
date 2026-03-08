import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Sprout } from "lucide-react";
import { fetchAllFarms, FarmInfo } from "@/lib/farm";
import { FarmCard } from "./FarmCard";

interface BrowseFarmsProps {
  onSelectFarm: (farmName: string) => void;
}

export function BrowseFarms({ onSelectFarm }: BrowseFarmsProps) {
  const [farms, setFarms] = useState<FarmInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAllFarms().then(data => {
      setFarms(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const sorted = [...farms].sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return b.staked_count - a.staked_count;
    });

    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(f =>
      f.farm_name.toLowerCase().includes(q) ||
      f.creator.toLowerCase().includes(q)
    );
  }, [farms, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search farms by name or creator..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No farms found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(farm => (
            <FarmCard key={farm.farm_name} farm={farm} onClick={onSelectFarm} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {farms.length} farms loaded from WaxDAO V2
      </p>
    </div>
  );
}
