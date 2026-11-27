import type { DaoInfo, Proposal } from "@/lib/dao";
import type { UserVote } from "@/lib/voteStorage";
import { ProposalCard } from "./ProposalCard";

interface DaoProposalListProps {
  proposals: Proposal[];
  emptyText: string;
  daoName: string;
  dao: DaoInfo;
  votedProposals: Record<number, UserVote>;
  onVote: (proposalId: number, voteData: UserVote) => void;
  locked?: boolean;
  onUnlock?: () => void;
}

/** Active / past proposal list on the DAO detail page. */
export function DaoProposalList({ proposals, emptyText, daoName, dao, votedProposals, onVote, locked, onUnlock }: DaoProposalListProps) {
  return (
    <div className="space-y-4">
      {locked && proposals.length > 0 && (
        <p className="text-xs text-muted-foreground">This DAO shows proposal details to members only. Blockchain records remain public.</p>
      )}
      {proposals.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{emptyText}</p>
      ) : (
        proposals.map(p => (
          <ProposalCard
            key={p.proposal_id}
            proposal={p}
            daoName={daoName}
            dao={dao}
            hasVoted={!!votedProposals[p.proposal_id]}
            userVote={votedProposals[p.proposal_id] || null}
            onVote={onVote}
            locked={locked}
            onUnlock={onUnlock}
          />
        ))
      )}
    </div>
  );
}
