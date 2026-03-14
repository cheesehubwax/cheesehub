import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ThumbsUp, ThumbsDown, MinusCircle, Loader2, Clock, ChevronDown, ChevronUp,
  RefreshCw, Coins, Image as ImageIcon, CheckCircle,
} from "lucide-react";
import {
  Proposal, DaoInfo,
  buildVoteAction, buildMultiOptionVoteAction, buildRankedChoiceVoteAction,
  buildFinalizeProposalAction, buildRecountProposalAction, buildClaimVoteRamAction,
  fetchUserVote, fetchUserStakedTokens,
  VOTING_TYPE_LABELS, PROPOSAL_VOTING_TYPES,
  UserVote, StakedToken,
} from "@/lib/dao";
import { saveVote, getVote } from "@/lib/voteStorage";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { NFTVotePicker } from "./NFTVotePicker";

interface ProposalCardProps {
  proposal: Proposal;
  daoName: string;
  dao: DaoInfo;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  passed: "bg-primary/20 text-primary border-primary/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
  executed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  expired: "bg-muted text-muted-foreground border-border",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  inconclusive: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export function ProposalCard({ proposal, daoName, dao }: ProposalCardProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [txLoading, setTxLoading] = useState(false);
  const [votingChoice, setVotingChoice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [stakedWeight, setStakedWeight] = useState<StakedToken | null>(null);
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);
  const [showNFTPicker, setShowNFTPicker] = useState(false);

  // Load user vote from blockchain + localStorage
  useEffect(() => {
    if (!accountName) return;
    const localVote = getVote(accountName, daoName, proposal.proposal_id);
    if (localVote) setUserVote(localVote);

    fetchUserVote(daoName, proposal.proposal_id, accountName).then(v => {
      if (v) setUserVote(v);
    });

    if (dao.dao_type === 4) {
      fetchUserStakedTokens(daoName, accountName).then(setStakedWeight);
    }
  }, [accountName, daoName, proposal.proposal_id, dao.dao_type]);

  const endDate = proposal.end_time_ts ? new Date(proposal.end_time_ts * 1000) : null;
  const isExpired = endDate ? endDate < new Date() : false;
  const isActive = proposal.status === "active";

  const isYesNoAbstain = proposal.voting_type === PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN;
  const isMostVotes = proposal.voting_type === PROPOSAL_VOTING_TYPES.MOST_VOTES_WINS;
  const isRankedChoice = proposal.voting_type === PROPOSAL_VOTING_TYPES.RANKED_CHOICE;
  const isTokenTransfer = proposal.voting_type === PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER;
  const isNFTTransfer = proposal.voting_type === PROPOSAL_VOTING_TYPES.NFT_TRANSFER;
  const isType5 = dao.dao_type === 5;

  const totalVotes = proposal.choices.reduce((sum, c) => {
    return sum + (typeof c.total_votes === "string" ? parseInt(c.total_votes) || 0 : c.total_votes || 0);
  }, 0);

  // Yes/No/Abstain vote handler
  const handleYNAVote = async (vote: "yes" | "no" | "abstain") => {
    if (!session || !accountName) return;
    setVotingChoice(vote);
    setTxLoading(true);

    const action = buildVoteAction(
      accountName, daoName, proposal.proposal_id, vote,
      stakedWeight ? String(stakedWeight.weight) : undefined,
      isType5 ? selectedNFTs : undefined
    );
    const result = await executeTransaction([action]);
    if (result.success) {
      const choiceMap: Record<string, number> = { yes: 0, no: 1, abstain: 2 };
      const voteData: UserVote = { choice_index: choiceMap[vote], weight: stakedWeight?.weight || 1 };
      saveVote(accountName, daoName, proposal.proposal_id, voteData);
      setUserVote(voteData);
    }
    setVotingChoice(null);
    setTxLoading(false);
  };

  // Multi-option vote handler
  const handleMultiVote = async (choiceIndex: number) => {
    if (!session || !accountName) return;
    setTxLoading(true);

    const action = isMostVotes
      ? buildMultiOptionVoteAction(
          accountName, daoName, proposal.proposal_id, choiceIndex,
          stakedWeight ? String(stakedWeight.weight) : undefined,
          isType5 ? selectedNFTs : undefined
        )
      : buildRankedChoiceVoteAction(
          accountName, daoName, proposal.proposal_id, choiceIndex,
          stakedWeight ? String(stakedWeight.weight) : undefined,
          isType5 ? selectedNFTs : undefined
        );

    const result = await executeTransaction([action]);
    if (result.success) {
      const voteData: UserVote = { choice_index: choiceIndex, weight: stakedWeight?.weight || 1 };
      saveVote(accountName, daoName, proposal.proposal_id, voteData);
      setUserVote(voteData);
    }
    setTxLoading(false);
  };

  const handleFinalize = async () => {
    if (!session || !accountName) return;
    setTxLoading(true);
    const action = buildFinalizeProposalAction(accountName, daoName, proposal.proposal_id);
    await executeTransaction([action]);
    setTxLoading(false);
  };

  const handleRecount = async () => {
    if (!session || !accountName) return;
    setTxLoading(true);
    const action = buildRecountProposalAction(accountName, daoName, proposal.proposal_id);
    await executeTransaction([action]);
    setTxLoading(false);
  };

  const canVote = isActive && accountName && !userVote && !isExpired;

  return (
    <Card className="bg-card/60 border-border/40">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground">{proposal.title}</h4>
            <p className={`text-sm text-muted-foreground mt-1 ${expanded ? "" : "line-clamp-2"}`}>
              {proposal.description}
            </p>
            {proposal.description.length > 120 && (
              <Button variant="ghost" size="sm" className="text-xs p-0 h-auto" onClick={() => setExpanded(!expanded)}>
                {expanded ? <><ChevronUp className="h-3 w-3 mr-1" /> Less</> : <><ChevronDown className="h-3 w-3 mr-1" /> More</>}
              </Button>
            )}
          </div>
          <Badge className={statusColors[proposal.status] || statusColors.pending}>
            {proposal.status}
          </Badge>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span>by {proposal.proposer}</span>
          <Badge variant="outline" className="text-xs">
            {VOTING_TYPE_LABELS[proposal.voting_type] || "Standard"}
          </Badge>
          {endDate && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isExpired ? "Ended" : "Ends"} {endDate.toLocaleDateString()}
            </span>
          )}
          {stakedWeight && (
            <span className="text-xs">Weight: {stakedWeight.balance}</span>
          )}
        </div>

        {/* Token Transfer Details */}
        {isTokenTransfer && proposal.token_receivers && proposal.token_receivers.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium flex items-center gap-1">
              <Coins className="h-3 w-3 text-primary" /> Token Transfer Details
            </p>
            {proposal.token_receivers.map((tr, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{tr.wax_account}</span>
                <span className="font-medium">{tr.quantity}</span>
              </div>
            ))}
          </div>
        )}

        {/* NFT Transfer Details */}
        {isNFTTransfer && proposal.nft_receivers && proposal.nft_receivers.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium flex items-center gap-1">
              <ImageIcon className="h-3 w-3 text-primary" /> NFT Transfer Details
            </p>
            {proposal.nft_receivers.map((nr, i) => (
              <div key={i} className="text-xs">
                <span className="text-muted-foreground">{nr.wax_account}</span>
                <span className="ml-2 font-medium">{nr.asset_ids.length} NFT(s)</span>
              </div>
            ))}
          </div>
        )}

        {/* Vote Results */}
        {totalVotes > 0 && (
          <div className="space-y-2">
            {isYesNoAbstain || isTokenTransfer || isNFTTransfer ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Yes: {proposal.yes_votes}</span>
                  <span className="text-destructive">No: {proposal.no_votes}</span>
                  <span className="text-muted-foreground">Abstain: {proposal.abstain_votes}</span>
                </div>
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
                  <div className="bg-green-500 transition-all" style={{ width: `${totalVotes > 0 ? (proposal.yes_votes / totalVotes) * 100 : 0}%` }} />
                  <div className="bg-destructive transition-all" style={{ width: `${totalVotes > 0 ? (proposal.no_votes / totalVotes) * 100 : 0}%` }} />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                {proposal.choices.map((choice, idx) => {
                  const votes = typeof choice.total_votes === "string" ? parseInt(choice.total_votes) || 0 : choice.total_votes || 0;
                  const percent = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className={userVote?.choice_index === idx ? "text-primary font-medium" : "text-muted-foreground"}>
                          {choice.description}
                        </span>
                        <span className="text-muted-foreground">{votes} ({percent.toFixed(1)}%)</span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{totalVotes} total votes</p>
          </div>
        )}

        {/* NFT Vote Picker for Type 5 DAOs */}
        {canVote && isType5 && (
          <div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowNFTPicker(!showNFTPicker)}>
              {showNFTPicker ? "Hide" : "Select"} NFTs to vote with ({selectedNFTs.length})
            </Button>
            {showNFTPicker && (
              <NFTVotePicker
                dao={dao}
                proposalId={proposal.proposal_id}
                onSelect={setSelectedNFTs}
                selectedIds={selectedNFTs}
              />
            )}
          </div>
        )}

        {/* Vote Buttons - Yes/No/Abstain */}
        {canVote && (isYesNoAbstain || isTokenTransfer || isNFTTransfer) && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm" variant="outline"
              className="flex-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
              onClick={() => handleYNAVote("yes")}
              disabled={txLoading || (isType5 && selectedNFTs.length === 0)}
            >
              {votingChoice === "yes" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-1" />}
              Yes
            </Button>
            <Button
              size="sm" variant="outline"
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => handleYNAVote("no")}
              disabled={txLoading || (isType5 && selectedNFTs.length === 0)}
            >
              {votingChoice === "no" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4 mr-1" />}
              No
            </Button>
            <Button
              size="sm" variant="outline" className="flex-1"
              onClick={() => handleYNAVote("abstain")}
              disabled={txLoading || (isType5 && selectedNFTs.length === 0)}
            >
              {votingChoice === "abstain" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MinusCircle className="h-4 w-4 mr-1" />}
              Abstain
            </Button>
          </div>
        )}

        {/* Vote Buttons - Multi Option / Ranked Choice */}
        {canVote && (isMostVotes || isRankedChoice) && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground">
              {isRankedChoice ? "Select your top choice (ranked voting)" : "Vote for an option"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {proposal.choices.map((choice, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant="outline"
                  onClick={() => handleMultiVote(idx)}
                  disabled={txLoading || (isType5 && selectedNFTs.length === 0)}
                  className="text-xs"
                >
                  {choice.description}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* User Vote Display */}
        {userVote && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span>
              You voted: {
                isYesNoAbstain || isTokenTransfer || isNFTTransfer
                  ? (userVote.choice_index === 0 ? "Yes" : userVote.choice_index === 1 ? "No" : "Abstain")
                  : proposal.choices[userVote.choice_index]?.description || `Choice ${userVote.choice_index}`
              }
              {userVote.weight > 0 && ` (weight: ${userVote.weight})`}
            </span>
          </div>
        )}

        {/* Finalize / Recount Actions */}
        {isActive && isExpired && accountName && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={handleFinalize} disabled={txLoading}>
              Finalize Proposal
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRecount} disabled={txLoading}>
              <RefreshCw className="h-3 w-3 mr-1" /> Recount
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
