// CHEESEDao model: contract name, fees, labels, shared types and pure helpers.
// Import from "@/lib/dao" (stable entry point), not this file directly.

export const DAO_CONTRACT = "dao.waxdao";

// Fee constants for DAO creation
export const DAO_CREATION_FEE = "265.00000000 WAX";

export const DAO_TYPES: Record<number, string> = {
  1: "Custodial NFT Farm",
  2: "Custodial Token Pool",
  3: "Stake to WaxDAO Pool",
  4: "Stake Tokens (Custodial)",
  5: "Hold NFTs (Non-Custodial)",
};

// Only these DAO types are available for creation on CHEESEHub
export const CREATABLE_DAO_TYPES: Record<number, string> = {
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
  0: "active", 1: "active", 2: "passed", 3: "rejected",
  4: "executed", 5: "quorum_not_met", 6: "expired",
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
  status: "pending" | "active" | "passed" | "rejected" | "executed" | "expired" | "inconclusive" | "quorum_not_met";
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

export interface TokenReceiver { wax_account: string; quantity: string; contract: string; }
export interface NFTReceiver { wax_account: string; asset_ids: string[]; }
export interface ProposalAction { contract: string; action: string; data: Record<string, unknown>; }

export interface Vote {
  voter: string; proposal_id: number; vote: "yes" | "no" | "abstain";
  weight: number; timestamp: string;
}

export interface UserVote {
  choice_index: number;
  weight: number;
  rankings?: number[];
}

export interface TreasuryBalance { contract: string; symbol: string; amount: number; precision: number; }

export interface TreasuryNFT {
  asset_id: string; name: string; image: string;
  collection: string; schema: string; template_id: string;
}

export interface StakedToken { balance: string; weight: number; }
export interface StakedNFT { asset_id: string; name: string; image: string; collection: string; schema: string; }

export interface UserNFT {
  asset_id: string; name: string; image: string;
  collection: string; schema: string; template_id: string;
}

export interface NFTTransferProposalData { recipient: string; assetIds: string[]; }

export interface TokenTransferProposalData {
  recipient: string; amount: string; tokenSymbol: string; tokenContract: string;
}

export interface DaoSocials {
  twitter?: string; discord?: string; telegram?: string; website?: string;
  youtube?: string; medium?: string; atomichub?: string; waxdao?: string;
}

// DAO Type configuration interface
export interface DaoTypeConfig {
  daoType: number;
  tokenContract?: string;
  tokenSymbol?: string;
  govFarmName?: string;
  govSchemas?: { collection_name: string; schema_name: string }[];
}
