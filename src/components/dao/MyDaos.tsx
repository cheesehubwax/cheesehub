import { useState, useEffect } from "react";
import { Loader2, Users } from "lucide-react";
import { fetchAllDaos, DaoInfo } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { DaoCard } from "./DaoCard";

interface MyDaosProps {
  onSelectDao: (daoName: string) => void;
}

export function MyDaos({ onSelectDao }: MyDaosProps) {
  const { accountName, isConnected } = useWax();
  const [daos, setDaos] = useState<DaoInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountName) {
      setDaos([]);
      setLoading(false);
      return;
    }

    fetchAllDaos().then(all => {
      const mine = all.filter(d => d.creator === accountName || d.authors?.includes(accountName));
      setDaos(mine);
      setLoading(false);
    });
  }, [accountName]);

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Connect your wallet to see your DAOs</p>
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

  if (daos.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">You haven't created any DAOs yet</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {daos.map(dao => (
        <DaoCard key={dao.dao_name} dao={dao} onClick={onSelectDao} />
      ))}
    </div>
  );
}
