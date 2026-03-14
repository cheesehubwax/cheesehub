import { useState, useEffect } from "react";
import { Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchUserDaos, DaoInfo } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { DaoCard } from "./DaoCard";

export function MyDaos() {
  const navigate = useNavigate();
  const { accountName, isConnected } = useWax();
  const [daos, setDaos] = useState<DaoInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountName) {
      setDaos([]);
      setLoading(false);
      return;
    }

    fetchUserDaos(accountName).then(data => {
      setDaos(data);
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
        <p className="text-muted-foreground">You're not a member of any DAOs yet</p>
        <p className="text-xs text-muted-foreground mt-1">Stake tokens or hold eligible NFTs to join a DAO</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {daos.map(dao => (
          <DaoCard key={dao.dao_name} dao={dao} onClick={(name) => navigate(`/dao/${name}`)} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {daos.length} DAO{daos.length !== 1 ? "s" : ""} where you have staked tokens/NFTs or hold eligible assets
      </p>
    </div>
  );
}
