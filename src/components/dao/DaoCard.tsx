import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, Clock, Coins, Tag, ExternalLink } from "lucide-react";
import { DaoInfo, DAO_TYPES, PROPOSER_TYPES } from "@/lib/dao";
import { TokenLogo } from "@/components/TokenLogo";
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

  const createdDate = dao.time_created
    ? new Date(dao.time_created * 1000).toLocaleDateString()
    : "";

  const isNftType = dao.dao_type === 1 || dao.dao_type === 5;
  const proposerLabel = PROPOSER_TYPES[dao.proposer_type] || "Unknown";

  return (
    <Card className="bg-card/80 border-primary/30 shadow-lg transition-all">
      <CardContent className="p-4 space-y-3">
        {/* Header: logo + name + type badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {logoSrc ? (
                <img src={logoSrc} alt={dao.dao_name} className="h-full w-full object-cover" onError={handleImgError} />
              ) : (
                <Users className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{dao.dao_name}</h3>
              <p className="text-xs text-muted-foreground truncate">by {dao.creator}</p>
            </div>
          </div>
          <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] shrink-0 whitespace-nowrap">
            {daoType}
          </Badge>
        </div>

        {/* Stat boxes: Threshold + Vote Duration */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/30">
            <BarChart3 className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
            <p className="text-base font-bold text-foreground">{dao.threshold}%</p>
            <p className="text-[10px] text-muted-foreground">Threshold</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/30">
            <Clock className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
            <p className="text-base font-bold text-foreground">{dao.hours_per_proposal}h</p>
            <p className="text-[10px] text-muted-foreground">Vote Duration</p>
          </div>
        </div>

        {/* Token/NFT info */}
        <div className="space-y-1.5 text-sm">
          {isNftType ? (
            <div className="flex items-center gap-2">
              <span className="text-sm shrink-0">🖼️</span>
              <span className="text-muted-foreground">NFT Collections:</span>
              <span className="font-medium text-foreground">{dao.gov_schemas?.length || 0}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <OpenMojiIcon emoji="💰" size={14} className="text-sm shrink-0" />
              <span className="text-muted-foreground">Gov Token:</span>
              <TokenLogo
                contract={dao.token_contract}
                symbol={dao.token_symbol?.includes(",") ? dao.token_symbol.split(",")[1] : dao.token_symbol}
                size="sm"
                className="h-4 w-4 shrink-0"
              />
              <span className="font-medium text-foreground">
                {dao.token_symbol ? (dao.token_symbol.includes(",") ? dao.token_symbol.split(",")[1] : dao.token_symbol) : "N/A"}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <OpenMojiIcon emoji="📜" size={14} className="text-sm shrink-0" />
            <span className="text-muted-foreground">Proposal Cost:</span>
            <span className="font-medium text-foreground">
              {dao.proposal_cost && dao.proposal_cost !== "0" ? dao.proposal_cost : "Free"}
            </span>
          </div>
        </div>

        {/* Footer: created date + proposer badge */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {createdDate ? `Created: ${createdDate}` : ""}
          </span>
          <Badge variant="outline" className="text-[10px] border-border/50">{proposerLabel}</Badge>
        </div>

        {/* View DAO button */}
        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" onClick={onClick}>
          <ExternalLink className="h-4 w-4" />
          View DAO
        </Button>
      </CardContent>
    </Card>
  );
}
