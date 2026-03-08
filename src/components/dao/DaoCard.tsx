import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { DaoInfo, DAO_TYPES, getIpfsUrl } from "@/lib/dao";

interface DaoCardProps {
  dao: DaoInfo;
  onClick: (daoName: string) => void;
}

export function DaoCard({ dao, onClick }: DaoCardProps) {
  const logoUrl = getIpfsUrl(dao.logo);
  const daoType = DAO_TYPES[dao.dao_type] || "Unknown";

  return (
    <Card
      className="bg-card/80 border-border/50 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group"
      onClick={() => onClick(dao.dao_name)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={dao.dao_name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <Users className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {dao.dao_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              by {dao.creator}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="secondary" className="text-xs">{daoType}</Badge>
              {dao.token_symbol && (
                <Badge variant="outline" className="text-xs">{dao.token_symbol}</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
