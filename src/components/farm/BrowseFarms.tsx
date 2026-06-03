import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Sprout } from "lucide-react";
import { fetchAllFarms, FarmInfo, fetchUserGlobalStakes } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useQuery } from "@tanstack/react-query";
import { FarmCard } from "./FarmCard";
import { useFarmClaimTotals } from "@/hooks/useFarmClaimTotals";

type SortOption = "newest" | "staked" | "name";

export function BrowseFarms() {
  const { accountName } = useWax();
  const { totals: claimTotals } = useFarmClaimTotals(accountName);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [stakedOnly, setStakedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("staked");

  const { data: farms = [], isLoading } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchAllFarms,
    staleTime: 60_000,
  });

  const { data: userStakes = [] } = useQuery({
    queryKey: ["userGlobalStakes", accountName],
    queryFn: () => fetchUserGlobalStakes(accountName!),
    enabled: !!accountName && stakedOnly,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    let result = [...farms];
    const now = Math.floor(Date.now() / 1000);

    if (activeOnly) {
      result = result.filter(f => f.is_active && (f.expiration === 0 || f.expiration > now));
    }

    if (stakedOnly && accountName) {
      const stakedFarmNames = new Set(userStakes.map(s => s.farmName));
      result = result.filter(f => stakedFarmNames.has(f.farm_name));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.farm_name.toLowerCase().includes(q) ||
        f.creator.toLowerCase().includes(q) ||
        f.reward_pools.some(p => p.symbol.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => b.time_created - a.time_created);
        break;
      case "staked":
        result.sort((a, b) => b.staked_count - a.staked_count);
        break;
      case "name":
        result.sort((a, b) => a.farm_name.localeCompare(b.farm_name));
        break;
    }

    return result;
  }, [farms, search, activeOnly, stakedOnly, sortBy, accountName, userStakes]);

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-center">
        <div className="relative max-w-md w-full mx-auto sm:mx-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search farms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
            <Label htmlFor="active-only" className="text-sm cursor-pointer">Active only</Label>
          </div>

          {accountName && (
            <div className="flex items-center gap-2">
              <Checkbox id="staked-only" checked={stakedOnly} onCheckedChange={(v) => setStakedOnly(!!v)} />
              <Label htmlFor="staked-only" className="text-sm cursor-pointer">Staked only</Label>
            </div>
          )}

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staked">Most Staked</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No farms found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(farm => (
            <FarmCard
              key={farm.farm_name}
              farm={farm}
              userClaimed={claimTotals[farm.farm_name]}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {farms.length} farms loaded from WaxDAO V2
      </p>
    </div>
  );
}
