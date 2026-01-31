// WaxDAO DAO Contract Interface
// Contract: dao.waxdao

import { getTokenConfig } from "@/lib/tokenRegistry";

export const DAO_CONTRACT = "dao.waxdao";

// Fee constants for DAO creation
export const DAO_CREATION_FEE = "250.00000000 WAX";

// Build action for announcing deposit (required before proposal payment)
export function buildAnnounceDepoAction(user: string) {
  return {
    account: DAO_CONTRACT,
    name: "announcedepo",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
    },
  };
}

// Build action for paying proposal cost
export function buildProposalCostAction(sender: string, proposalCost: string) {
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: DAO_CONTRACT,
      quantity: proposalCost,
      memo: "|proposal_payment|",
    },
  };
}

// Build action for paying DAO creation fee
export function buildDaoCreationFeeAction(sender: string) {
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: DAO_CONTRACT,
      quantity: DAO_CREATION_FEE,
      memo: "|dao_payment|",
    },
  };
}

// Build action for asserting payment (required before createdao)
export function buildAssertPointAction(user: string) {
  return {
    account: DAO_CONTRACT,
    name: "assertpoint",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
    },
  };
}

// Build action for finalizing a proposal after voting ends
export function buildFinalizeProposalAction(user: string, daoName: string, proposalId: number) {
  return {
    account: DAO_CONTRACT,
    name: "finalize",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
      dao: daoName,
      proposal_id: proposalId,
    },
  };
}

export const DAO_TYPES: Record<number, string> = {
  1: "Custodial NFT Farm",
  2: "Custodial Token Pool",
  3: "Stake to WaxDAO Pool",
  4: "Stake Tokens (Custodial)",
  5: "Hold NFTs (Non-Custodial)",
};

export const PROPOSER_TYPES: Record<number, string> = {
  0: "Authors Only",
  1: "Anyone",
  2: "Token Holders",
};

export const PROPOSAL_VOTING_TYPES = {
  YES_NO_ABSTAIN: 1,
  MOST_VOTES_WINS: 2,
  RANKED_CHOICE: 3,
  TOKEN_TRANSFER: 4,
  NFT_TRANSFER: 5,
} as const;

export const VOTING_TYPE_LABELS: Record<number, string> = {
  1: "Yes/No/Abstain",
  2: "Most Votes Wins",
  3: "Ranked Choice",
  4: "Token Transfer",
  5: "NFT Transfer",
};

export const OUTCOME_STATUS: Record<number, string> = {
  0: "active",
  1: "active",
  2: "passed",
  3: "rejected",
  4: "executed",
  5: "rejected",
  6: "expired",
};

export const EXPIRY_THRESHOLD = 30 * 24 * 60 * 60;

export interface DaoInfo {
  dao_name: string;
  creator: string;
  description: string;
  logo: string;
  cover_image: string;
  token_contract: string;
  token_symbol: string;
  dao_type: number;
  proposer_type: number;
  threshold: number;
  hours_per_proposal: number;
  minimum_weight: number;
  minimum_votes: number;
  proposal_cost: string;
  authors: string[];
  gov_schemas: { collection_name: string; schema_name: string }[];
  time_created: number;
  status: number;
  socials?: DaoSocials;
}

export function getIpfsUrl(hash: string): string {
  if (!hash) return "";
  if (hash.startsWith("http")) return hash;
  if (hash.startsWith("Qm") || hash.startsWith("bafy")) {
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return hash;
}

export interface ProposalChoice {
  choice: number;
  description: string;
  total_votes: number | string;
}

export interface Proposal {
  proposal_id: number;
  dao_name: string;
  proposer: string;
  title: string;
  description: string;
  proposal_type: string;
  voting_type: number;
  status: "pending" | "active" | "passed" | "rejected" | "executed" | "expired" | "inconclusive";
  yes_votes: number;
  no_votes: number;
  abstain_votes: number;
  choices: ProposalChoice[];
  start_time: string;
  end_time: string;
  end_time_ts: number;
  total_votes: number;
  actions: ProposalAction[];
  token_receivers?: TokenReceiver[];
  nft_receivers?: NFTReceiver[];
}

export interface TokenReceiver {
  wax_account: string;
  quantity: string;
  contract: string;
}

export interface NFTReceiver {
  wax_account: string;
  asset_ids: string[];
}

export interface ProposalAction {
  contract: string;
  action: string;
  data: Record<string, unknown>;
}

export interface Vote {
  voter: string;
  proposal_id: number;
  vote: "yes" | "no" | "abstain";
  weight: number;
  timestamp: string;
}

export interface UserVote {
  choice_index: number;
  weight: number;
  rankings?: number[];
}

export interface TreasuryBalance {
  contract: string;
  symbol: string;
  amount: number;
  precision: number;
}

export interface TreasuryNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}

export interface StakedToken {
  balance: string;
  weight: number;
}

export interface StakedNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
}

export interface UserNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}

export interface NFTTransferProposalData {
  recipient: string;
  assetIds: string[];
}

export interface DaoSocials {
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  youtube?: string;
  medium?: string;
  atomichub?: string;
  waxdao?: string;
}

// Fetch all DAOs from the contract
export async function fetchAllDaos(): Promise<DaoInfo[]> {
  try {
    const daoResponse = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: DAO_CONTRACT,
          table: "daos",
          limit: 100,
        }),
      }
    );

    const data = await daoResponse.json();
    console.log("Raw DAO data:", data);

    return (data.rows || []).map((row: Record<string, unknown>) => {
      const daoName = row.daoname as string || "";

      return {
        dao_name: daoName,
        creator: row.creator as string || "",
        description: "",
        logo: "",
        cover_image: "",
        token_contract: row.gov_token_contract as string || "",
        token_symbol: row.gov_token_symbol as string || "",
        dao_type: row.dao_type as number || 0,
        proposer_type: row.proposer_type as number || 0,
        threshold: parseFloat(row.threshold as string) || 0,
        hours_per_proposal: row.hours_per_proposal as number || 0,
        minimum_weight: typeof row.minimum_weight === 'string'
          ? parseInt(row.minimum_weight)
          : row.minimum_weight as number || 0,
        minimum_votes: row.minimum_votes as number || 0,
        proposal_cost: row.proposal_cost as string || "0",
        authors: row.authors as string[] || [],
        gov_schemas: row.gov_schemas as { collection_name: string; schema_name: string }[] || [],
        time_created: row.time_created as number || 0,
        status: row.status as number || 0,
      };
    });
  } catch (error) {
    console.error("Error fetching DAOs:", error);
    return [];
  }
}

// Fetch details for a specific DAO
export async function fetchDaoDetails(daoName: string): Promise<DaoInfo | null> {
  try {
    const allDaos = await fetchAllDaos();
    return allDaos.find(dao => dao.dao_name === daoName) || null;
  } catch (error) {
    console.error("Error fetching DAO details:", error);
    return null;
  }
}

// Fetch proposals for a DAO
export async function fetchProposals(daoName: string): Promise<Proposal[]> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: daoName,
          table: "proposals",
          limit: 100,
        }),
      }
    );

    const data = await response.json();
    const now = Math.floor(Date.now() / 1000);

    return (data.rows || []).map((row: Record<string, unknown>) => {
      const choices = row.choices as ProposalChoice[] || [];
      const outcome = typeof row.outcome === 'number' ? row.outcome : 0;
      const endTime = row.end_time as number || 0;
      const contractProposalType = (row.proposal_type as number) ?? 0;

      let yesVotes = 0;
      let noVotes = 0;
      let abstainVotes = 0;

      choices.forEach((choice: ProposalChoice) => {
        const votes = typeof choice.total_votes === 'string'
          ? parseInt(choice.total_votes) || 0
          : choice.total_votes || 0;
        const choiceDesc = choice.description?.toLowerCase();
        if (choiceDesc === "yes") yesVotes = votes;
        else if (choiceDesc === "no") noVotes = votes;
        else if (choiceDesc === "abstain") abstainVotes = votes;
      });

      let status: "pending" | "active" | "passed" | "rejected" | "executed" | "expired" | "inconclusive" = "pending";

      if (outcome === 2 || outcome === 4 || outcome === 5) {
        status = outcome === 4 ? "executed" : (yesVotes > noVotes ? "passed" : "rejected");
      } else if (outcome === 3) {
        status = "rejected";
      } else if (endTime > now) {
        status = "active";
      } else if (now - endTime > EXPIRY_THRESHOLD) {
        status = "expired";
      }

      let votingType: number;
      switch (contractProposalType) {
        case 0: votingType = PROPOSAL_VOTING_TYPES.MOST_VOTES_WINS; break;
        case 1: votingType = PROPOSAL_VOTING_TYPES.RANKED_CHOICE; break;
        case 2: votingType = PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER; break;
        case 3: votingType = PROPOSAL_VOTING_TYPES.NFT_TRANSFER; break;
        case 4: votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN; break;
        default: votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN;
      }

      return {
        proposal_id: (row.proposal_id as number) || 0,
        dao_name: daoName,
        proposer: (row.author as string) || "",
        title: (row.title as string) || "",
        description: (row.description as string) || "",
        proposal_type: String(contractProposalType),
        voting_type: votingType,
        status,
        yes_votes: yesVotes,
        no_votes: noVotes,
        abstain_votes: abstainVotes,
        choices: choices,
        start_time: (row.start_time as string) || "",
        end_time: endTime.toString(),
        end_time_ts: endTime,
        total_votes: (row.total_votes as number) || 0,
        actions: (row.actions as ProposalAction[]) || [],
        token_receivers: (row.token_receivers as TokenReceiver[]) || [],
        nft_receivers: (row.nft_receivers as NFTReceiver[]) || [],
      };
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
}

// Build action for voting on a Yes/No/Abstain proposal
export function buildVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  vote: "yes" | "no" | "abstain",
  voteWeight?: string,
  assetIds?: string[]
) {
  const choiceMap: Record<string, number> = { yes: 0, no: 1, abstain: 2 };
  const data: Record<string, unknown> = {
    user: voter,
    dao: daoName,
    proposal_id: proposalId,
    choice: choiceMap[vote],
    asset_ids: assetIds || [],
  };

  if (voteWeight) {
    data.weight = voteWeight;
  }

  return {
    account: DAO_CONTRACT,
    name: "vote",
    authorization: [{ actor: voter, permission: "active" }],
    data,
  };
}
