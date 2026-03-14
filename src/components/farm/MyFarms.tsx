import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sprout, Plus } from "lucide-react";
import { fetchUserFarms } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useQuery } from "@tanstack/react-query";
import { FarmCard } from "./FarmCard";

interface MyFarmsProps {
  onCreateFarm: () => void;
}

export function MyFarms({ onCreateFarm }: MyFarmsProps) {
  const { accountName, isConnected } = useWax();

  const { data: farms = [], isLoading } = useQuery({
    queryKey: ["my-farms", accountName],
    queryFn: () => fetchUserFarms(accountName!),
    enabled: !!accountName,
    staleTime: 30_000,
  });

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Connect your wallet to see your farms</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">You haven't created any farms yet</p>
        <Button onClick={onCreateFarm} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Farm
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{farms.length} farm(s) found</p>
        <Button onClick={onCreateFarm} size="sm" className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Create Farm
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {farms.map(farm => (
          <FarmCard key={farm.farm_name} farm={farm} />
        ))}
      </div>
    </div>
  );
}
