import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { DaoInfo, DAO_TYPES, PROPOSER_TYPES } from "@/lib/dao";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";

interface DaoCardProps {
  dao: DaoInfo;
  onClick: () => void;
}

export function DaoCard({ dao, onClick }: DaoCardProps) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const daoType = DAO_TYPES[dao.dao_type] || "Unknown";

  const logoSrc = useMemo(() => {
    if (!dao.logo) return "";
    if (dao.logo.startsWith("http")) return dao.logo;
    if (dao.logo.startsWith("Qm") || dao.logo.startsWith("bafy")) {
      return `${IPFS_GATEWAYS[gatewayIdx % IPFS_GATEWAYS.length]}${dao.logo}`;
    }
    return dao.logo;
  }, [dao.logo, gatewayIdx]);

  const handleImgError = useCallback(() => {
    setGatewayIdx(prev => prev + 1 < IPFS_GATEWAYS.length ? prev + 1 : prev);
  }, []);

  return (
    <Card className="bg-card/80 border-primary/30 shadow-lg transition-all group">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {logoSrc ? (
              <img src={logoSrc} alt={dao.dao_name} className="h-full w-full object-cover" onError={handleImgError} />
            ) : (
              <Users className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {dao.dao_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">by {dao.creator}</p>
            {dao.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{dao.description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Threshold</p>
            <p className="font-medium">{dao.threshold}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Duration</p>
            <p className="font-medium">{dao.hours_per_proposal}h</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cost</p>
            <p className="font-medium">{dao.proposal_cost && dao.proposal_cost !== "0" ? dao.proposal_cost.split(" ")[0] : "Free"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">{daoType}</Badge>
          <Badge variant="outline" className="text-xs">{PROPOSER_TYPES[dao.proposer_type] || "Unknown"}</Badge>
          {dao.token_symbol && <Badge variant="outline" className="text-xs">{dao.token_symbol}</Badge>}
        </div>

        <Button size="sm" variant="outline" className="w-full" onClick={onClick}>
          View DAO
        </Button>
      </CardContent>
    </Card>
  );
}
