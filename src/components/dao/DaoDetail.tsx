import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, Users, Vote, Plus, Settings, Coins, Image as ImageIcon,
  ExternalLink, ChevronRight, Info, Layers, Archive, Clock, BarChart3, Tag, RefreshCw, Wallet,
} from "lucide-react";
import {
  fetchDaoDetails, fetchProposals, fetchDaoTreasury, fetchDaoTreasuryNFTs,
  checkDaoMembership, fetchUserStakedTokens,
  DaoInfo, Proposal, TreasuryBalance, TreasuryNFT,
  DAO_TYPES, PROPOSER_TYPES, StakedToken,
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
import { TokenLogo } from "@/components/TokenLogo";
import type { UserVote } from "@/lib/voteStorage";

type Section = "info" | "stake" | "new-proposal" | "active" | "past" | "treasury";

interface DaoDetailProps {
  daoName: string;
  onBack: () => void;
}

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

export function DaoDetail({ daoName, onBack }: DaoDetailProps) {
  const { isConnected, accountName } = useWax();

  const [dao, setDao] = useState<DaoInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [treasury, setTreasury] = useState<TreasuryBalance[]>([]);
  const [treasuryNFTs, setTreasuryNFTs] = useState<TreasuryNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [treasuryLoaded, setTreasuryLoaded] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [stakedWeight, setStakedWeight] = useState<StakedToken | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("info");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editCostOpen, setEditCostOpen] = useState(false);
  const [votedProposals, setVotedProposals] = useState<Record<number, UserVote>>({});

  // Reset treasury when switching DAOs
  useEffect(() => {
    setTreasury([]);
    setTreasuryNFTs([]);
    setTreasuryLoaded(false);
  }, [daoName]);

  const isCreator = dao?.creator === accountName;
  const isAuthor = dao?.authors?.includes(accountName || "") || false;
  const canEditProfile = isCreator || isAuthor;

  const logo = useIpfsImageSrc(dao?.logo);
  const cover = useIpfsImageSrc(dao?.cover_image);

  const loadDao = useCallback(async () => {
    if (!daoName) return;
    setLoading(true);
    const [daoData, proposalData] = await Promise.all([
      fetchDaoDetails(daoName),
      fetchProposals(daoName),
    ]);
    if (daoData) setDao(daoData);
    setProposals(proposalData);
    setLoading(false);
  }, [daoName]);

  useEffect(() => { loadDao(); }, [loadDao]);

  useEffect(() => {
    if (accountName && daoName) {
      const localVotes = getVotesForDao(accountName, daoName);
      setVotedProposals(localVotes);
    }
  }, [accountName, daoName]);

  useEffect(() => {
    if (accountName && daoName) {
      checkDaoMembership(daoName, accountName).then(setIsMember);
      if (dao?.dao_type === 4) {
        fetchUserStakedTokens(daoName, accountName).then(setStakedWeight);
      }
    }
  }, [accountName, daoName, dao?.dao_type]);

  useEffect(() => {
    if (activeSection === "treasury" && !treasuryLoaded && daoName) {
      Promise.all([
        fetchDaoTreasury(daoName),
        fetchDaoTreasuryNFTs(daoName),
      ]).then(([tokens, nfts]) => {
        setTreasury(tokens);
        setTreasuryNFTs(nfts);
        setTreasuryLoaded(true);
      });
    }
  }, [activeSection, treasuryLoaded, daoName]);

  const refreshProposals = useCallback(() => {
    fetchProposals(daoName).then(setProposals);
  }, [daoName]);

  const refreshTreasury = useCallback(() => {
    fetchDaoTreasury(daoName).then(setTreasury);
    fetchDaoTreasuryNFTs(daoName).then(setTreasuryNFTs);
  }, [daoName]);

  const handleVote = useCallback((proposalId: number, voteData: UserVote) => {
    if (!accountName) return;
    saveVote(accountName, daoName, proposalId, voteData);
    setVotedProposals(prev => ({ ...prev, [proposalId]: voteData }));
    setTimeout(() => {
      fetchProposals(daoName).then(setProposals);
    }, 3000);
  }, [accountName, daoName]);

  const activeProposals = useMemo(() => proposals.filter(p => p.status === "active"), [proposals]);
  const pastProposals = useMemo(() => proposals.filter(p => p.status !== "active"), [proposals]);

  const unvotedCount = useMemo(() => {
    if (!accountName) return 0;
    return activeProposals.filter(p => !votedProposals[p.proposal_id]).length;
  }, [activeProposals, votedProposals, accountName]);

  const canPropose = isConnected && (
    dao?.proposer_type === 1 ||
    (dao?.proposer_type === 0 && isAuthor) ||
    isMember
  );

  const menuItems: { key: Section; label: string; icon: React.ReactNode; badge?: number; pulse?: boolean; hidden?: boolean }[] = [
    { key: "info", label: "DAO Info", icon: <Info className="h-4 w-4" /> },
    { key: "stake", label: "Stake", icon: <Layers className="h-4 w-4" />, hidden: dao?.dao_type === 5 },
    { key: "new-proposal", label: "New Proposal", icon: <Plus className="h-4 w-4" />, hidden: !canPropose },
    { key: "active", label: "Active Proposals", icon: <Vote className="h-4 w-4" />, badge: activeProposals.length, pulse: unvotedCount > 0 },
    { key: "past", label: "Past Proposals", icon: <Archive className="h-4 w-4" />, badge: pastProposals.length },
    { key: "treasury", label: "Treasury", icon: <Coins className="h-4 w-4" /> },
  ];

  const socialEntries = useMemo(() => {
    if (!dao?.socials) return [];
    const entries: { key: string; label: string; url: string }[] = [];
    const s = dao.socials;
    if (s.twitter) entries.push({ key: "twitter", label: "Twitter", url: s.twitter });
    if (s.discord) entries.push({ key: "discord", label: "Discord", url: s.discord });
    if (s.telegram) entries.push({ key: "telegram", label: "Telegram", url: s.telegram });
    if (s.website) entries.push({ key: "website", label: "Website", url: s.website });
    if ((s as any).atomichub) entries.push({ key: "atomichub", label: "AtomicHub", url: (s as any).atomichub });
    if ((s as any).waxdao) entries.push({ key: "waxdao", label: "WaxDAO", url: (s as any).waxdao });
    if (s.youtube) entries.push({ key: "youtube", label: "YouTube", url: s.youtube });
    if (s.medium) entries.push({ key: "medium", label: "Medium", url: s.medium });
    return entries;
  }, [dao?.socials]);

  const createdDate = dao?.time_created
    ? new Date(dao.time_created * 1000).toLocaleDateString()
    : "Unknown";

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
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">DAO not found</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to DAOs
        </Button>
      </div>
    );
  }

  const daoTypeLabel = DAO_TYPES[dao.dao_type] || "Unknown";

  const renderContent = () => {
    switch (activeSection) {
      case "info":
        return (
          <div className="space-y-6">
            {/* DAO Information header */}
            <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Info className="h-4 w-4 text-primary" /> DAO Information
            </h3>

            {/* Stat cards row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-3 text-center">
                  <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{dao.threshold}%</p>
                  <p className="text-[11px] text-muted-foreground">Vote Threshold</p>
                </CardContent>
              </Card>
              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-3 text-center">
                  <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{dao.hours_per_proposal}h</p>
                  <p className="text-[11px] text-muted-foreground">Vote Duration</p>
                </CardContent>
              </Card>
              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-3 text-center">
                  <Vote className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{proposals.length}</p>
                  <p className="text-[11px] text-muted-foreground">Total Proposals</p>
                </CardContent>
              </Card>
              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-3 text-center">
                  <Tag className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">
                    {dao.proposal_cost && dao.proposal_cost !== "0" ? dao.proposal_cost : "Free"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Proposal Cost</p>
                </CardContent>
              </Card>
            </div>

            {/* Governance Settings */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Governance Settings</h4>
              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-border/30">
                        <td className="px-4 py-2.5 text-muted-foreground">DAO Type</td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">{daoTypeLabel}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">Who can propose</td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">{PROPOSER_TYPES[dao.proposer_type] || "Unknown"}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-muted-foreground">Token</td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {dao.token_symbol ? `${dao.token_symbol} (${dao.token_contract})` : "N/A"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">Min votes required</td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {dao.minimum_votes > 0 ? dao.minimum_votes.toLocaleString() : "0"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            {dao.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Description</h4>
                <Card className="bg-card/60 border-border/40">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dao.description}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Social Links */}
            {socialEntries.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Social Links</h4>
                <Card className="bg-card/60 border-border/40">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {socialEntries.map(s => (
                        <Button key={s.key} variant="outline" size="sm" asChild>
                          <a
                            href={s.url.startsWith("http") ? s.url : `https://${s.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="text-xs">{s.label}</span>
                          </a>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Cover Image */}
            {cover.src && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                  <ImageIcon className="h-4 w-4 text-primary" /> Cover Image
                </h4>
                <Card className="bg-card/60 border-border/40 overflow-hidden">
                  <CardContent className="p-0">
                    <img
                      src={cover.src}
                      alt={`${dao.dao_name} cover`}
                      className="w-full h-auto max-h-[500px] object-contain"
                      onError={cover.onError}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Authors */}
            {dao.authors && dao.authors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Authors</h4>
                <div className="flex flex-wrap gap-1">
                  {dao.authors.map(a => (
                    <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Governance Schemas */}
            {dao.gov_schemas && dao.gov_schemas.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Governance Schemas</h4>
                <div className="flex flex-wrap gap-1">
                  {dao.gov_schemas.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {s.collection_name} / {s.schema_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "stake":
        return <DaoStaking daoName={daoName} dao={dao} />;

      case "new-proposal":
        return (
          <CreateProposal
            daoName={daoName}
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
                  daoName={daoName}
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
                  daoName={daoName}
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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Treasury
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshTreasury}
                disabled={!treasuryLoaded}
              >
                {!treasuryLoaded ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span className="ml-1">Refresh</span>
                  </>
                )}
              </Button>
            </div>

            {/* Treasury Token Balances */}
            {!treasuryLoaded ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : treasury.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No Treasury Balance</p>
                <p className="text-sm">Deposit tokens below to fund this DAO</p>
              </div>
            ) : (
              <div className="space-y-2">
                {treasury.map((balance, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <TokenLogo contract={balance.contract} symbol={balance.symbol} size="lg" className="h-10 w-10" />
                      <div>
                        <p className="font-medium">{balance.symbol}</p>
                        <p className="text-xs text-muted-foreground">{balance.contract}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold">{balance.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Treasury NFTs */}
            {treasuryLoaded && treasuryNFTs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">NFTs in Treasury</h4>
                  <Badge variant="secondary" className="text-xs">{treasuryNFTs.length}</Badge>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                  {treasuryNFTs.map(nft => (
                    <div
                      key={nft.asset_id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-border/50"
                    >
                      {nft.image ? (
                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                        <p className="text-[8px] text-white truncate">{nft.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Token Deposit Form */}
            <TreasuryDeposit daoName={daoName} onDeposited={refreshTreasury} />

            {/* NFT Deposit Form */}
            <TreasuryNFTDeposit daoName={daoName} onDeposited={refreshTreasury} />

            {/* Withdrawal Info */}
            <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How to withdraw from treasury?</p>
              <p>Create a <span className="text-primary font-medium">Token Transfer</span> or <span className="text-primary font-medium">NFT Transfer</span> proposal. Once the proposal passes, the assets will be transferred to the specified recipient.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to DAOs
      </Button>

      {/* Header: logo + name + badge + created date */}
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
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{daoTypeLabel}</Badge>
            {isMember && <Badge variant="secondary" className="text-xs">Member</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Created by {dao.creator} on {createdDate}
          </p>
        </div>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-0 min-h-[400px]">
        {/* Left sidebar */}
        <div className="w-44 shrink-0 space-y-0.5 pr-4 border-r border-border/30">
          {menuItems.filter(m => !m.hidden).map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
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
              {activeSection === item.key && <ChevronRight className="h-3 w-3 shrink-0" />}
            </button>
          ))}

          {/* Creator/Author actions */}
          {canEditProfile && (
            <div className="pt-3 mt-3 space-y-0.5 border-t border-border/30">
              <button
                onClick={() => setEditProfileOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
              {isCreator && (
                <button
                  onClick={() => setEditCostOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Coins className="h-4 w-4" />
                  <span>Prop Cost</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right content area */}
        <div className="flex-1 min-w-0 pl-6">
          {renderContent()}
        </div>
      </div>

      {/* Dialogs */}
      {dao && (
        <>
          <EditDaoProfile open={editProfileOpen} onOpenChange={setEditProfileOpen} dao={dao} onUpdated={loadDao} />
          <EditProposalCost open={editCostOpen} onOpenChange={setEditCostOpen} daoName={dao.dao_name} currentCost={dao.proposal_cost || "0"} onUpdated={loadDao} />
        </>
      )}
    </div>
  );
}
