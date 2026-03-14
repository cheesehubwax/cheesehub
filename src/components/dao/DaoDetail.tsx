import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Loader2, Users, Vote, Plus, Settings, Coins, Image as ImageIcon,
  ExternalLink, Globe, HardDrive,
} from "lucide-react";
import {
  fetchDaoDetails, fetchProposals, fetchDaoTreasury, fetchDaoTreasuryNFTs,
  checkDaoMembership,
  DaoInfo, Proposal, TreasuryBalance, TreasuryNFT,
  DAO_TYPES, PROPOSER_TYPES, getIpfsUrl,
} from "@/lib/dao";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { useWax } from "@/context/WaxContext";
import { ProposalCard } from "./ProposalCard";
import { CreateProposal } from "./CreateProposal";
import { DaoStaking } from "./DaoStaking";
import { ClaimVoteRam } from "./ClaimVoteRam";
import { EditDaoProfile } from "./EditDaoProfile";
import { EditProposalCost } from "./EditProposalCost";
import { TreasuryDeposit } from "./TreasuryDeposit";
import { TreasuryNFTDeposit } from "./TreasuryNFTDeposit";

interface DaoDetailProps {
  daoName: string;
  onBack: () => void;
}

export function DaoDetail({ daoName, onBack }: DaoDetailProps) {
  const { isConnected, accountName } = useWax();
  const [dao, setDao] = useState<DaoInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [treasury, setTreasury] = useState<TreasuryBalance[]>([]);
  const [treasuryNFTs, setTreasuryNFTs] = useState<TreasuryNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editCostOpen, setEditCostOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("proposals");

  const isCreator = dao?.creator === accountName;

  const loadDao = useCallback(async () => {
    setLoading(true);
    const [daoData, proposalData, treasuryData, nftData] = await Promise.all([
      fetchDaoDetails(daoName),
      fetchProposals(daoName),
      fetchDaoTreasury(daoName),
      fetchDaoTreasuryNFTs(daoName),
    ]);
    setDao(daoData);
    setProposals(proposalData);
    setTreasury(treasuryData);
    setTreasuryNFTs(nftData);
    setLoading(false);
  }, [daoName]);

  useEffect(() => { loadDao(); }, [loadDao]);

  useEffect(() => {
    if (accountName && daoName) {
      checkDaoMembership(daoName, accountName).then(setIsMember);
    }
  }, [accountName, daoName]);

  const refreshProposals = () => fetchProposals(daoName).then(setProposals);
  const refreshTreasury = () => {
    fetchDaoTreasury(daoName).then(setTreasury);
    fetchDaoTreasuryNFTs(daoName).then(setTreasuryNFTs);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dao) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">DAO not found</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const logoUrl = getIpfsUrl(dao.logo);
  const coverUrl = getIpfsUrl(dao.cover_image);
  const activeProposals = proposals.filter(p => p.status === "active");
  const pastProposals = proposals.filter(p => p.status !== "active");

  const canPropose = isConnected && (
    dao.proposer_type === 1 ||
    (dao.proposer_type === 0 && dao.authors?.includes(accountName || "")) ||
    isMember
  );

  // Social links
  const socialLinks = [
    { key: "twitter", icon: "𝕏", url: dao.socials?.twitter },
    { key: "discord", icon: "💬", url: dao.socials?.discord },
    { key: "telegram", icon: "✈️", url: dao.socials?.telegram },
    { key: "website", icon: "🌐", url: dao.socials?.website },
    { key: "youtube", icon: "▶️", url: dao.socials?.youtube },
    { key: "medium", icon: "📝", url: dao.socials?.medium },
  ].filter(s => s.url);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to DAOs
      </Button>

      {/* Cover Image */}
      {coverUrl && (
        <div className="relative h-48 rounded-xl overflow-hidden">
          <img src={coverUrl} alt="" className="w-full h-full object-cover" onError={(e) => {
            const img = e.target as HTMLImageElement;
            const currentSrc = img.src;
            const nextGateway = IPFS_GATEWAYS.find(g => !currentSrc.includes(g));
            if (nextGateway && dao.cover_image) {
              const hash = dao.cover_image.replace(/^https?:\/\/[^/]+\/ipfs\//, "");
              img.src = `${nextGateway}${hash}`;
            }
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}

      {/* DAO Header */}
      <Card className="bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="h-20 w-20 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={dao.dao_name} className="h-full w-full object-cover" onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  const currentSrc = img.src;
                  const nextGateway = IPFS_GATEWAYS.find(g => !currentSrc.includes(g));
                  if (nextGateway && dao.logo) {
                    const hash = dao.logo.replace(/^https?:\/\/[^/]+\/ipfs\//, "");
                    img.src = `${nextGateway}${hash}`;
                  } else {
                    img.style.display = "none";
                  }
                }} />
              ) : (
                <Users className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-foreground">{dao.dao_name}</h2>
                {isMember && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Member</Badge>}
              </div>
              <p className="text-muted-foreground mt-1">Created by {dao.creator}</p>
              {dao.description && (
                <p className="text-sm text-muted-foreground mt-2">{dao.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary">{DAO_TYPES[dao.dao_type] || "Unknown"}</Badge>
                <Badge variant="outline">{PROPOSER_TYPES[dao.proposer_type] || "Unknown"}</Badge>
                {dao.token_symbol && <Badge variant="outline">{dao.token_symbol}</Badge>}
              </div>

              {/* Social Links */}
              {socialLinks.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {socialLinks.map(s => (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:text-primary transition-colors"
                      title={s.key}
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Creator Actions */}
            {isCreator && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditProfileOpen(true)}>
                  <Settings className="h-4 w-4 mr-1" /> Edit Profile
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditCostOpen(true)}>
                  <Coins className="h-4 w-4 mr-1" /> Prop Cost
                </Button>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-border/50">
            <div>
              <p className="text-sm text-muted-foreground">Proposals</p>
              <p className="text-lg font-semibold">{proposals.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-lg font-semibold text-primary">{activeProposals.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Threshold</p>
              <p className="text-lg font-semibold">{dao.threshold}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Proposal Cost</p>
              <p className="text-lg font-semibold">{dao.proposal_cost && dao.proposal_cost !== "0" ? dao.proposal_cost : "Free"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Treasury</p>
              <p className="text-lg font-semibold">{treasury.length} token{treasury.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="proposals">
            <Vote className="h-4 w-4 mr-1 hidden sm:inline" />
            Proposals
          </TabsTrigger>
          <TabsTrigger value="stake">Stake</TabsTrigger>
          <TabsTrigger value="treasury">Treasury</TabsTrigger>
          <TabsTrigger value="ram">
            <HardDrive className="h-4 w-4 mr-1 hidden sm:inline" />
            RAM
          </TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-4 mt-4">
          {canPropose && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowCreateProposal(!showCreateProposal)}>
                <Plus className="h-4 w-4 mr-1" /> New Proposal
              </Button>
            </div>
          )}

          {showCreateProposal && dao && (
            <CreateProposal
              daoName={daoName}
              dao={dao}
              treasuryNFTs={treasuryNFTs}
              onClose={() => setShowCreateProposal(false)}
              onCreated={() => {
                setShowCreateProposal(false);
                refreshProposals();
              }}
            />
          )}

          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({activeProposals.length})</TabsTrigger>
              <TabsTrigger value="past">Past ({pastProposals.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="space-y-4 mt-4">
              {activeProposals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active proposals</p>
              ) : (
                activeProposals.map(p => (
                  <ProposalCard key={p.proposal_id} proposal={p} daoName={daoName} dao={dao} />
                ))
              )}
            </TabsContent>
            <TabsContent value="past" className="space-y-4 mt-4">
              {pastProposals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No past proposals</p>
              ) : (
                pastProposals.map(p => (
                  <ProposalCard key={p.proposal_id} proposal={p} daoName={daoName} dao={dao} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Stake Tab */}
        <TabsContent value="stake" className="mt-4">
          <DaoStaking daoName={daoName} dao={dao} />
        </TabsContent>

        {/* Treasury Tab */}
        <TabsContent value="treasury" className="space-y-4 mt-4">
          {/* Token Balances */}
          {treasury.length > 0 && (
            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" /> Token Balances
                </h4>
                <div className="space-y-2">
                  {treasury.map((t, i) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                      <span className="text-sm font-medium">{t.symbol}</span>
                      <span className="text-sm text-muted-foreground">{t.amount.toFixed(t.precision)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Treasury NFTs */}
          {treasuryNFTs.length > 0 && (
            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" /> NFTs ({treasuryNFTs.length})
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto">
                  {treasuryNFTs.map(nft => (
                    <div key={nft.asset_id} className="rounded-lg border border-border/40 overflow-hidden">
                      <div className="aspect-square bg-muted/30 flex items-center justify-center">
                        {nft.image ? (
                          <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-[10px] text-center truncate px-1 py-0.5">{nft.name}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {treasury.length === 0 && treasuryNFTs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Treasury is empty
            </div>
          )}

          {/* Deposit Forms */}
          {isConnected && (
            <div className="grid md:grid-cols-2 gap-4">
              <TreasuryDeposit daoName={daoName} onDeposited={refreshTreasury} />
              <TreasuryNFTDeposit daoName={daoName} onDeposited={refreshTreasury} />
            </div>
          )}
        </TabsContent>

        {/* RAM Tab */}
        <TabsContent value="ram" className="mt-4">
          <ClaimVoteRam daoName={daoName} />
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4">
          <Card className="bg-card/60 border-border/40">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">DAO Type</p>
                  <p className="font-medium">{DAO_TYPES[dao.dao_type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Who Can Propose</p>
                  <p className="font-medium">{PROPOSER_TYPES[dao.proposer_type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Token</p>
                  <p className="font-medium">{dao.token_symbol || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Token Contract</p>
                  <p className="font-medium">{dao.token_contract || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Threshold</p>
                  <p className="font-medium">{dao.threshold}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hours Per Proposal</p>
                  <p className="font-medium">{dao.hours_per_proposal}h</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Min Votes</p>
                  <p className="font-medium">{dao.minimum_votes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Min Weight</p>
                  <p className="font-medium">{dao.minimum_weight}</p>
                </div>
              </div>

              {dao.authors && dao.authors.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Authors</p>
                  <div className="flex flex-wrap gap-1">
                    {dao.authors.map(a => (
                      <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {dao.gov_schemas && dao.gov_schemas.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Governance Schemas</p>
                  <div className="flex flex-wrap gap-1">
                    {dao.gov_schemas.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {s.collection_name} / {s.schema_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <a
                  href={`https://waxblock.io/account/dao.waxdao?action=createdao&search=${dao.dao_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> View on WaxBlock
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {dao && (
        <>
          <EditDaoProfile
            open={editProfileOpen}
            onOpenChange={setEditProfileOpen}
            dao={dao}
            onUpdated={loadDao}
          />
          <EditProposalCost
            open={editCostOpen}
            onOpenChange={setEditCostOpen}
            daoName={dao.dao_name}
            currentCost={dao.proposal_cost || "0"}
            onUpdated={loadDao}
          />
        </>
      )}
    </div>
  );
}
