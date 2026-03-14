import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, Users, Vote, Plus, Settings, Coins, Image as ImageIcon,
  ExternalLink, ChevronRight, Info, Layers, Archive, HardDrive, X,
} from "lucide-react";
import {
  fetchDaoDetails, fetchProposals, fetchDaoTreasury, fetchDaoTreasuryNFTs,
  checkDaoMembership, fetchUserStakedTokens,
  DaoInfo, Proposal, TreasuryBalance, TreasuryNFT,
  DAO_TYPES, PROPOSER_TYPES, getIpfsUrl, StakedToken,
} from "@/lib/dao";
import { getVotesForDao, saveVote } from "@/lib/voteStorage";
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
import type { UserVote } from "@/lib/voteStorage";

type Section = "info" | "stake" | "new-proposal" | "active" | "past" | "treasury";

interface DaoDetailProps {
  dao?: DaoInfo | null;
  daoName?: string;
  open?: boolean;
  onClose?: () => void;
  pageMode?: boolean;
}

// IPFS fallback with index tracking
function useIpfsImageSrc(hash: string | undefined) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const src = useMemo(() => {
    if (!hash) return "";
    if (hash.startsWith("http")) return hash;
    if (hash.startsWith("Qm") || hash.startsWith("bafy")) {
      return `${IPFS_GATEWAYS[gatewayIdx % IPFS_GATEWAYS.length]}${hash}`;
    }
    return hash;
  }, [hash, gatewayIdx]);

  const onError = useCallback(() => {
    setGatewayIdx(prev => prev + 1 < IPFS_GATEWAYS.length ? prev + 1 : prev);
  }, []);

  return { src, onError };
}

export function DaoDetail({ dao: initialDao, daoName: propDaoName, open, onClose, pageMode }: DaoDetailProps) {
  const { isConnected, accountName } = useWax();
  const resolvedDaoName = initialDao?.dao_name || propDaoName || "";

  const [dao, setDao] = useState<DaoInfo | null>(initialDao || null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [treasury, setTreasury] = useState<TreasuryBalance[]>([]);
  const [treasuryNFTs, setTreasuryNFTs] = useState<TreasuryNFT[]>([]);
  const [loading, setLoading] = useState(!initialDao);
  const [treasuryLoaded, setTreasuryLoaded] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [stakedWeight, setStakedWeight] = useState<StakedToken | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("info");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editCostOpen, setEditCostOpen] = useState(false);

  // Vote tracking from localStorage
  const [votedProposals, setVotedProposals] = useState<Record<number, UserVote>>({});

  const isCreator = dao?.creator === accountName;
  const isAuthor = dao?.authors?.includes(accountName || "") || false;
  const canEditProfile = isCreator || isAuthor;

  const logo = useIpfsImageSrc(dao?.logo);

  // Load DAO data
  const loadDao = useCallback(async () => {
    if (!resolvedDaoName) return;
    setLoading(true);
    const [daoData, proposalData] = await Promise.all([
      initialDao ? Promise.resolve(initialDao) : fetchDaoDetails(resolvedDaoName),
      fetchProposals(resolvedDaoName),
    ]);
    if (daoData) setDao(daoData);
    setProposals(proposalData);
    setLoading(false);
  }, [resolvedDaoName, initialDao]);

  useEffect(() => { loadDao(); }, [loadDao]);

  // Load vote state from localStorage
  useEffect(() => {
    if (accountName && resolvedDaoName) {
      const localVotes = getVotesForDao(accountName, resolvedDaoName);
      setVotedProposals(localVotes);
    }
  }, [accountName, resolvedDaoName]);

  // Check membership
  useEffect(() => {
    if (accountName && resolvedDaoName) {
      checkDaoMembership(resolvedDaoName, accountName).then(setIsMember);
      if (dao?.dao_type === 4) {
        fetchUserStakedTokens(resolvedDaoName, accountName).then(setStakedWeight);
      }
    }
  }, [accountName, resolvedDaoName, dao?.dao_type]);

  // Lazy treasury loading
  useEffect(() => {
    if (activeSection === "treasury" && !treasuryLoaded && resolvedDaoName) {
      Promise.all([
        fetchDaoTreasury(resolvedDaoName),
        fetchDaoTreasuryNFTs(resolvedDaoName),
      ]).then(([tokens, nfts]) => {
        setTreasury(tokens);
        setTreasuryNFTs(nfts);
        setTreasuryLoaded(true);
      });
    }
  }, [activeSection, treasuryLoaded, resolvedDaoName]);

  const refreshProposals = useCallback(() => {
    fetchProposals(resolvedDaoName).then(setProposals);
  }, [resolvedDaoName]);

  const refreshTreasury = useCallback(() => {
    fetchDaoTreasury(resolvedDaoName).then(setTreasury);
    fetchDaoTreasuryNFTs(resolvedDaoName).then(setTreasuryNFTs);
  }, [resolvedDaoName]);

  // Vote handler - optimistic update + delayed refresh
  const handleVote = useCallback((proposalId: number, voteData: UserVote) => {
    if (!accountName) return;
    saveVote(accountName, resolvedDaoName, proposalId, voteData);
    setVotedProposals(prev => ({ ...prev, [proposalId]: voteData }));

    // Delayed refresh to let blockchain settle
    setTimeout(() => {
      fetchProposals(resolvedDaoName).then(setProposals);
    }, 3000);
  }, [accountName, resolvedDaoName]);

  const activeProposals = useMemo(() => proposals.filter(p => p.status === "active"), [proposals]);
  const pastProposals = useMemo(() => proposals.filter(p => p.status !== "active"), [proposals]);

  // Count unvoted active proposals
  const unvotedCount = useMemo(() => {
    if (!accountName) return 0;
    return activeProposals.filter(p => !votedProposals[p.proposal_id]).length;
  }, [activeProposals, votedProposals, accountName]);

  const canPropose = isConnected && (
    dao?.proposer_type === 1 ||
    (dao?.proposer_type === 0 && isAuthor) ||
    isMember
  );

  // Sidebar menu items
  const menuItems: { key: Section; label: string; icon: React.ReactNode; badge?: number; pulse?: boolean; hidden?: boolean }[] = [
    { key: "info", label: "DAO Info", icon: <Info className="h-4 w-4" /> },
    { key: "stake", label: "Stake", icon: <Layers className="h-4 w-4" />, hidden: dao?.dao_type === 5 },
    { key: "new-proposal", label: "New Proposal", icon: <Plus className="h-4 w-4" />, hidden: !canPropose },
    { key: "active", label: "Active", icon: <Vote className="h-4 w-4" />, badge: activeProposals.length, pulse: unvotedCount > 0 },
    { key: "past", label: "Past", icon: <Archive className="h-4 w-4" />, badge: pastProposals.length },
    { key: "treasury", label: "Treasury", icon: <Coins className="h-4 w-4" /> },
  ];

  // Social links
  const socialLinks = useMemo(() => [
    { key: "twitter", icon: "𝕏", url: dao?.socials?.twitter },
    { key: "discord", icon: "💬", url: dao?.socials?.discord },
    { key: "telegram", icon: "✈️", url: dao?.socials?.telegram },
    { key: "website", icon: "🌐", url: dao?.socials?.website },
    { key: "youtube", icon: "▶️", url: dao?.socials?.youtube },
    { key: "medium", icon: "📝", url: dao?.socials?.medium },
  ].filter(s => s.url), [dao?.socials]);

  // --- Content renderer ---
  const renderContent = () => {
    if (!dao) return null;

    switch (activeSection) {
      case "info":
        return <DaoInfoSection dao={dao} socialLinks={socialLinks} />;
      case "stake":
        return <DaoStaking daoName={resolvedDaoName} dao={dao} />;
      case "new-proposal":
        return (
          <CreateProposal
            daoName={resolvedDaoName}
            dao={dao}
            treasuryNFTs={treasuryNFTs}
            onClose={() => setActiveSection("active")}
            onCreated={() => {
              setActiveSection("active");
              refreshProposals();
            }}
          />
        );
      case "active":
        return (
          <div className="space-y-4">
            {activeProposals.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No active proposals</p>
            ) : (
              activeProposals.map(p => (
                <ProposalCard
                  key={p.proposal_id}
                  proposal={p}
                  daoName={resolvedDaoName}
                  dao={dao}
                  hasVoted={!!votedProposals[p.proposal_id]}
                  userVote={votedProposals[p.proposal_id] || null}
                  onVote={handleVote}
                />
              ))
            )}
          </div>
        );
      case "past":
        return (
          <div className="space-y-4">
            {pastProposals.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No past proposals</p>
            ) : (
              pastProposals.map(p => (
                <ProposalCard
                  key={p.proposal_id}
                  proposal={p}
                  daoName={resolvedDaoName}
                  dao={dao}
                  hasVoted={!!votedProposals[p.proposal_id]}
                  userVote={votedProposals[p.proposal_id] || null}
                  onVote={handleVote}
                />
              ))
            )}
          </div>
        );
      case "treasury":
        return (
          <div className="space-y-4">
            {!treasuryLoaded ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
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
                  <div className="text-center py-8 text-muted-foreground text-sm">Treasury is empty</div>
                )}

                {isConnected && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <TreasuryDeposit daoName={resolvedDaoName} onDeposited={refreshTreasury} />
                    <TreasuryNFTDeposit daoName={resolvedDaoName} onDeposited={refreshTreasury} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // --- Sidebar ---
  const renderSidebar = () => (
    <div className="w-48 shrink-0 space-y-1">
      {menuItems.filter(m => !m.hidden).map(item => (
        <button
          key={item.key}
          onClick={() => setActiveSection(item.key)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            activeSection === item.key
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${item.pulse ? "animate-pulse bg-primary/20 text-primary" : ""}`}
            >
              {item.badge}
            </Badge>
          )}
          {activeSection === item.key && <ChevronRight className="h-3 w-3" />}
        </button>
      ))}

      {/* Creator/Author actions in sidebar */}
      {canEditProfile && (
        <div className="pt-4 space-y-1 border-t border-border/30 mt-4">
          <button
            onClick={() => setEditProfileOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Edit Profile</span>
          </button>
          {isCreator && (
            <button
              onClick={() => setEditCostOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Coins className="h-4 w-4" />
              <span>Prop Cost</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  // --- Header ---
  const renderHeader = () => {
    if (!dao) return null;
    return (
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
          {logo.src ? (
            <img src={logo.src} alt={dao.dao_name} className="h-full w-full object-cover" onError={logo.onError} />
          ) : (
            <Users className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground">{dao.dao_name}</h2>
            <Badge variant="secondary" className="text-xs">{DAO_TYPES[dao.dao_type] || "Unknown"}</Badge>
            {isMember && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Member</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">by {dao.creator}</p>
        </div>
      </div>
    );
  };

  // --- Loading ---
  if (loading) {
    const spinner = (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
    if (pageMode) return spinner;
    return (
      <Dialog open={open} onOpenChange={() => onClose?.()}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0" hideClose>
          {spinner}
        </DialogContent>
      </Dialog>
    );
  }

  if (!dao) {
    const notFound = (
      <div className="text-center py-16">
        <p className="text-muted-foreground">DAO not found</p>
      </div>
    );
    if (pageMode) return notFound;
    return null;
  }

  // --- Main layout: sidebar + content ---
  const mainLayout = (
    <div className="flex gap-6 min-h-[400px]">
      {renderSidebar()}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );

  // --- Dialogs (shared) ---
  const dialogs = dao && (
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
  );

  // --- Page mode ---
  if (pageMode) {
    return (
      <div className="space-y-6">
        {renderHeader()}
        {mainLayout}
        {dialogs}
      </div>
    );
  }

  // --- Dialog mode ---
  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose?.()}>
        <DialogContent
          className="max-w-4xl max-h-[85vh] p-0 overflow-hidden"
          hideClose
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="flex flex-col h-full max-h-[85vh]">
            {/* Dialog header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              {renderHeader()}
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 ml-4">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable body */}
            <ScrollArea className="flex-1 px-6 py-4">
              {mainLayout}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      {dialogs}
    </>
  );
}

// --- DAO Info sub-section ---
function DaoInfoSection({ dao, socialLinks }: { dao: DaoInfo; socialLinks: { key: string; icon: string; url?: string }[] }) {
  return (
    <Card className="bg-card/60 border-border/40">
      <CardContent className="p-4 space-y-4">
        {dao.description && (
          <p className="text-sm text-muted-foreground">{dao.description}</p>
        )}

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
            <p className="text-muted-foreground">Vote Duration</p>
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
          <div>
            <p className="text-muted-foreground">Proposal Cost</p>
            <p className="font-medium">{dao.proposal_cost && dao.proposal_cost !== "0" ? dao.proposal_cost : "Free"}</p>
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

        {socialLinks.length > 0 && (
          <div className="flex gap-3 pt-2">
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
  );
}
