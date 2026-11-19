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
}

/** Active / past proposal list on the DAO detail page. */
export function DaoProposalList({ proposals, emptyText, daoName, dao, votedProposals, onVote }: DaoProposalListProps) {
  return (
    <div className="space-y-4">
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
          />
        ))
      )}
    </div>
  );
}
