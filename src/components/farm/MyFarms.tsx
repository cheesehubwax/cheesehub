import { useState, useEffect } from "react";
import { Loader2, Sprout } from "lucide-react";
import { fetchUserFarms, FarmInfo } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { FarmCard } from "./FarmCard";

interface MyFarmsProps {
  onSelectFarm: (farmName: string) => void;
}

export function MyFarms({ onSelectFarm }: MyFarmsProps) {
  const { accountName, isConnected } = useWax();
  const [farms, setFarms] = useState<FarmInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountName) {
      setFarms([]);
      setLoading(false);
      return;
    }
    fetchUserFarms(accountName).then(data => {
      setFarms(data);
      setLoading(false);
    });
  }, [accountName]);

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Connect your wallet to see your farms</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">You haven't created any farms yet</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {farms.map(farm => (
        <FarmCard key={farm.farm_name} farm={farm} onClick={onSelectFarm} />
      ))}
    </div>
  );
}
