import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users } from "lucide-react";
import { fetchAllDaos, DaoInfo } from "@/lib/dao";
import { DaoCard } from "./DaoCard";
import { DaoDetail } from "./DaoDetail";

export function BrowseDaos() {
  const [daos, setDaos] = useState<DaoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDao, setSelectedDao] = useState<DaoInfo | null>(null);

  useEffect(() => {
    fetchAllDaos().then(data => {
      setDaos(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return daos;
    const q = search.toLowerCase();
    return daos.filter(d =>
      d.dao_name.toLowerCase().includes(q) ||
      d.creator.toLowerCase().includes(q) ||
      d.token_symbol?.toLowerCase().includes(q)
    );
  }, [daos, search]);

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
          placeholder="Search DAOs by name, creator, or token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No DAOs found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(dao => (
            <DaoCard key={dao.dao_name} dao={dao} onClick={() => setSelectedDao(dao)} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {daos.length} DAOs loaded from WaxDAO
      </p>

      <DaoDetail
        dao={selectedDao}
        open={!!selectedDao}
        onClose={() => setSelectedDao(null)}
      />
    </div>
  );
}
