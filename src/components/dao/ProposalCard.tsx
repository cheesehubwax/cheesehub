import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThumbsUp, ThumbsDown, MinusCircle, Loader2, Clock } from "lucide-react";
import { Proposal, buildVoteAction, VOTING_TYPE_LABELS, buildFinalizeProposalAction } from "@/lib/dao";
import { saveVote, getVote } from "@/lib/voteStorage";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface ProposalCardProps {
  proposal: Proposal;
  daoName: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  passed: "bg-primary/20 text-primary border-primary/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
  executed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  expired: "bg-muted text-muted-foreground border-border",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export function ProposalCard({ proposal, daoName }: ProposalCardProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [txLoading, setTxLoading] = useState(false);
  const [votingChoice, setVotingChoice] = useState<string | null>(null);

  const existingVote = accountName ? getVote(accountName, daoName, proposal.proposal_id) : null;
  const totalVotes = proposal.yes_votes + proposal.no_votes + proposal.abstain_votes;
  const yesPercent = totalVotes > 0 ? (proposal.yes_votes / totalVotes) * 100 : 0;
  const noPercent = totalVotes > 0 ? (proposal.no_votes / totalVotes) * 100 : 0;

  const endDate = proposal.end_time_ts ? new Date(proposal.end_time_ts * 1000) : null;
  const isExpired = endDate ? endDate < new Date() : false;

  const handleVote = async (vote: "yes" | "no" | "abstain") => {
    if (!session || !accountName) return;
    setVotingChoice(vote);

    const action = buildVoteAction(accountName, daoName, proposal.proposal_id, vote);
    const result = await executeTransaction(Array.isArray(action) ? action : [action]);

    if (result.success) {
      saveVote(accountName, daoName, proposal.proposal_id, {
        choice_index: vote === "yes" ? 0 : vote === "no" ? 1 : 2,
        weight: 1,
      });
    }
    setVotingChoice(null);
  };

  const handleFinalize = async () => {
    if (!session || !accountName) return;
    const action = buildFinalizeProposalAction(accountName, daoName, proposal.proposal_id);
    await executeTransaction(Array.isArray(action) ? action : [action]);
  };

  return (
    <Card className="bg-card/60 border-border/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground">{proposal.title}</h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{proposal.description}</p>
          </div>
          <Badge className={statusColors[proposal.status] || statusColors.pending}>
            {proposal.status}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>by {proposal.proposer}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {VOTING_TYPE_LABELS[proposal.voting_type] || "Standard"}
          </span>
          {endDate && (
            <span>{isExpired ? "Ended" : "Ends"} {endDate.toLocaleDateString()}</span>
          )}
        </div>

        {/* Vote Progress */}
        {totalVotes > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Yes: {proposal.yes_votes}</span>
              <span className="text-destructive">No: {proposal.no_votes}</span>
              <span className="text-muted-foreground">Abstain: {proposal.abstain_votes}</span>
            </div>
            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
              <div className="bg-green-500 transition-all" style={{ width: `${yesPercent}%` }} />
              <div className="bg-destructive transition-all" style={{ width: `${noPercent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{totalVotes} total votes</p>
          </div>
        )}

        {/* Vote Buttons */}
        {proposal.status === "active" && accountName && !existingVote && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
              onClick={() => handleVote("yes")}
              disabled={txLoading}
            >
              {votingChoice === "yes" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-1" />}
              Yes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => handleVote("no")}
              disabled={txLoading}
            >
              {votingChoice === "no" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4 mr-1" />}
              No
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleVote("abstain")}
              disabled={txLoading}
            >
              {votingChoice === "abstain" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MinusCircle className="h-4 w-4 mr-1" />}
              Abstain
            </Button>
          </div>
        )}

        {existingVote && (
          <p className="text-sm text-muted-foreground">
            ✅ You voted: {existingVote.choice_index === 0 ? "Yes" : existingVote.choice_index === 1 ? "No" : "Abstain"}
          </p>
        )}

        {/* Finalize Button */}
        {proposal.status === "active" && isExpired && accountName && (
          <Button size="sm" variant="outline" onClick={handleFinalize} disabled={txLoading}>
            Finalize Proposal
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
