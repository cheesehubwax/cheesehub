import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Users, Settings, Coins, ChevronRight } from "lucide-react";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import {
  fetchDaoDetails, fetchProposals, fetchDaoTreasury, fetchDaoTreasuryNFTs,
  checkDaoMembership, fetchUserStakedTokens,
  DaoInfo, Proposal, TreasuryBalance, TreasuryNFT,
  DAO_TYPES, StakedToken,
} from "@/lib/dao";
import { getVotesForDao, saveVote } from "@/lib/voteStorage";
import { useWax } from "@/context/WaxContext";
import { useIpfsImageSrc } from "@/hooks/useIpfsImageSrc";
import { CreateProposal } from "./CreateProposal";
import { DaoStaking } from "./DaoStaking";
import { ClaimVoteRam } from "./ClaimVoteRam";
import { EditDaoProfile } from "./EditDaoProfile";
import { EditProposalCost } from "./EditProposalCost";
import { DaoInfoSection } from "./DaoInfoSection";
import { DaoProposalList } from "./DaoProposalList";
import { DaoTreasurySection } from "./DaoTreasurySection";
import { daoSocialEntries } from "@/lib/daoSocials";
import type { UserVote } from "@/lib/voteStorage";

type Section = "info" | "stake" | "new-proposal" | "active" | "past" | "treasury" | "ram";

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

  // After a new proposal is signed, chain nodes can take a few seconds to list it.
  // Re-read on a short schedule until a proposal ID we haven't seen appears.
  const proposalPollRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => proposalPollRef.current.forEach(clearTimeout), [daoName]);
  const pollForNewProposal = useCallback(() => {
    proposalPollRef.current.forEach(clearTimeout);
    proposalPollRef.current = [];
    const known = new Set(proposals.map(p => p.proposal_id));
    let found = false;
    const check = async () => {
      if (found) return;
      const next = await fetchProposals(daoName);
      if (found) return;
      if (next.some(p => !known.has(p.proposal_id))) {
        found = true;
        proposalPollRef.current.forEach(clearTimeout);
      }
      setProposals(next);
    };
    check();
    proposalPollRef.current = [1500, 3000, 5000, 8000, 12000].map(ms => setTimeout(check, ms));
  }, [daoName, proposals]);

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
    { key: "info", label: "DAO Info", icon: <span className="text-sm">ℹ️</span> },
    { key: "stake", label: "Stake", icon: <OpenMojiIcon emoji="⛏️" size={14} className="text-sm" />, hidden: dao?.dao_type === 5 },
    { key: "new-proposal", label: "New Proposal", icon: <OpenMojiIcon emoji="✍️" size={14} className="text-sm" />, hidden: !canPropose },
    { key: "active", label: "Active Proposals", icon: <OpenMojiIcon emoji="📢" size={14} className="text-sm" />, badge: activeProposals.length, pulse: unvotedCount > 0 },
    { key: "past", label: "Past Proposals", icon: <OpenMojiIcon emoji="🕰️" size={14} className="text-sm" />, badge: pastProposals.length },
    { key: "treasury", label: "Treasury", icon: <OpenMojiIcon emoji="💎" size={14} className="text-sm" /> },
    { key: "ram", label: "Claim Vote RAM", icon: <OpenMojiIcon emoji="💾" size={14} className="text-sm" />, hidden: !isConnected },
  ];

  const socialEntries = useMemo(() => daoSocialEntries(dao?.socials), [dao?.socials]);

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
        return <DaoInfoSection dao={dao} proposalsCount={proposals.length} socialEntries={socialEntries} cover={cover} />;

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
              pollForNewProposal();
            }}
          />
        );

      case "active":
        return (
          <DaoProposalList proposals={activeProposals} emptyText="No active proposals" daoName={daoName} dao={dao} votedProposals={votedProposals} onVote={handleVote} />
        );

      case "past":
        return (
          <DaoProposalList proposals={pastProposals} emptyText="No past proposals" daoName={daoName} dao={dao} votedProposals={votedProposals} onVote={handleVote} />
        );

      case "treasury":
        return (
          <DaoTreasurySection
            daoName={daoName}
            treasury={treasury}
            treasuryNFTs={treasuryNFTs}
            treasuryLoaded={treasuryLoaded}
            onRefresh={refreshTreasury}
          />
        );

      case "ram":
        return <ClaimVoteRam daoName={daoName} />;

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
