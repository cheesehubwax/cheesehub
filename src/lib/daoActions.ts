// CHEESEDao transaction action builders (pure; nothing is sent from here).
// Import from "@/lib/dao" (stable entry point), not this file directly.

import { getTokenConfig } from "@/lib/tokenRegistry";
import {
  DAO_CONTRACT, DAO_CREATION_FEE,
  type DaoSocials, type ProposalAction, type TokenTransferProposalData, type NFTTransferProposalData,
} from "./daoModel";

// Build action for announcing deposit (required before proposal payment)
export function buildAnnounceDepoAction(user: string) {
  return {
    account: DAO_CONTRACT,
    name: "announcedepo",
    authorization: [{ actor: user, permission: "active" }],
    data: { user },
  };
}

// Build action for paying proposal cost. tokenContract defaults to eosio.token (WAX).
export function buildProposalCostAction(sender: string, proposalCost: string, tokenContract = "eosio.token") {
  return {
    account: tokenContract,
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
    data: { user },
  };
}

// Build action for finalizing a proposal after voting ends
export function buildFinalizeProposalAction(user: string, daoName: string, proposalId: number) {
  return {
    account: DAO_CONTRACT,
    name: "finalize",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, dao: daoName, proposal_id: proposalId },
  };
}

// Build action for claiming vote RAM after proposal ends (Type 5 Hold NFT DAOs)
export function buildClaimVoteRamAction(
  user: string, daoName: string, proposalId: number, skip = 0, max = 100
) {
  return {
    account: DAO_CONTRACT,
    name: "claimvoteram",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, dao: daoName, proposal_id: proposalId, skip, max },
  };
}

// Build action for recounting votes
export function buildRecountProposalAction(user: string, daoName: string, proposalId: number) {
  return {
    account: DAO_CONTRACT,
    name: "recount",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, dao: daoName, proposal_id: proposalId },
  };
}

// Build action for editing proposal cost (creator only)
export function buildEditPropCostAction(user: string, daoName: string, proposalCost: string) {
  return {
    account: DAO_CONTRACT,
    name: "editpropcost",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, dao: daoName, proposal_cost: proposalCost },
  };
}

// --- Action builders ---

export function buildCreateDaoAction(
  creator: string,
  config: {
    daoName: string; daoType?: number; tokenContract?: string; tokenSymbol?: string;
    govFarmName?: string; govSchemas?: { collection_name: string; schema_name: string }[];
    threshold?: number; hoursPerProposal?: number; minimumWeight?: number;
    minimumVotes?: number; proposerType?: number; authors?: string[];
    proposalCost?: number; proposalCostSymbol?: string; proposalCostPrecision?: number;
  }
) {
  const feeSymbol = config.proposalCostSymbol || "WAX";
  const feePrecision = config.proposalCostPrecision ?? 8;
  const proposalCostFormatted = `${(config.proposalCost || 0).toFixed(feePrecision)} ${feeSymbol}`;
  const daoType = config.daoType || 4;
  const useToken = daoType === 4;
  const useFarm = [1, 2, 3].includes(daoType);
  const useSchemas = [1, 2, 5].includes(daoType);

  // gov_token_symbol must be an extended-symbol string "<precision>,<SYMBOL>".
  // For non-token DAOs the contract expects the sentinel "0,NULL" / "null".
  let govTokenSymbol = "0,NULL";
  let govTokenContract = "null";
  if (useToken) {
    const rawSym = (config.tokenSymbol || "").trim();
    if (rawSym.includes(",")) {
      // Already in "precision,SYMBOL" form
      govTokenSymbol = rawSym.toUpperCase().replace(/^([0-9]+),\s*/, (_, p) => `${p},`);
    } else if (rawSym) {
      govTokenSymbol = `8,${rawSym.toUpperCase()}`;
    }
    govTokenContract = (config.tokenContract || "").trim() || "null";
  }

  return {
    account: DAO_CONTRACT,
    name: "createdao",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      user: creator,
      daoname: config.daoName,
      dao_type: daoType,
      gov_token_contract: govTokenContract,
      gov_token_symbol: govTokenSymbol,
      gov_farm_name: useFarm ? (config.govFarmName || "null") : "null",
      gov_schemas: useSchemas ? (config.govSchemas || []) : [],
      threshold: config.threshold || 50.0,
      hours_per_proposal: config.hoursPerProposal || 72,
      minimum_weight: config.minimumWeight || 0,
      minimum_votes: config.minimumVotes || 1,
      // Use ?? so a valid `0` ("Authors Only") isn't coerced to 1 ("Anyone").
      proposer_type: config.proposerType ?? 1,
      authors: config.authors || [],
      proposal_cost: proposalCostFormatted,
    },
  };
}

export function buildSetProfileAction(
  user: string, daoName: string, description: string, avatar = "", coverImage = ""
) {
  return {
    account: DAO_CONTRACT,
    name: "setprofile",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user, dao: daoName,
      profile: { avatar: avatar || "", cover_image: coverImage || "", description: description || "" },
      socials: { atomichub: "", discord: "", medium: "", telegram: "", twitter: "", waxdao: "", website: "", youtube: "" },
    },
  };
}

export function buildSetProfileActionWithSocials(
  user: string, daoName: string, description: string,
  avatar = "", coverImage = "", socials: DaoSocials = {}
) {
  return {
    account: DAO_CONTRACT,
    name: "setprofile",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user, dao: daoName,
      profile: { avatar: avatar || "", cover_image: coverImage || "", description: description || "" },
      socials: {
        atomichub: socials.atomichub || "", discord: socials.discord || "",
        medium: socials.medium || "", telegram: socials.telegram || "",
        twitter: socials.twitter || "", waxdao: socials.waxdao || "",
        website: socials.website || "", youtube: socials.youtube || "",
      },
    },
  };
}

export function buildCreateProposalAction(
  proposer: string, daoName: string,
  proposal: { title: string; description: string; proposalType: string; actions?: ProposalAction[] }
) {
  return {
    account: DAO_CONTRACT, name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer, dao: daoName, title: proposal.title, description: proposal.description,
      proposal_type: 4,
      choices: [
        { choice: 0, description: "Yes", total_votes: 0 },
        { choice: 1, description: "No", total_votes: 0 },
        { choice: 2, description: "Abstain", total_votes: 0 },
      ],
      actions: proposal.actions || [], token_receivers: [], nft_receivers: [], proof_asset_ids: [],
    },
  };
}

export function buildMultiOptionProposalAction(
  proposer: string, daoName: string,
  proposal: { title: string; description: string; options: string[] }
) {
  return {
    account: DAO_CONTRACT, name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer, dao: daoName, title: proposal.title, description: proposal.description,
      proposal_type: 0,
      choices: proposal.options.map((opt, idx) => ({ choice: idx, description: opt, total_votes: 0 })),
      actions: [], token_receivers: [], nft_receivers: [], proof_asset_ids: [],
    },
  };
}

export function buildRankedChoiceProposalAction(
  proposer: string, daoName: string,
  proposal: { title: string; description: string; options: string[] }
) {
  return {
    account: DAO_CONTRACT, name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer, dao: daoName, title: proposal.title, description: proposal.description,
      proposal_type: 1,
      choices: proposal.options.map((opt, idx) => ({ choice: idx, description: opt, total_votes: 0 })),
      actions: [], token_receivers: [], nft_receivers: [], proof_asset_ids: [],
    },
  };
}

export function buildTokenTransferProposalAction(
  proposer: string, daoName: string,
  proposal: { title: string; description: string; transfer: TokenTransferProposalData }
) {
  const tokenConfig = getTokenConfig(proposal.transfer.tokenSymbol);
  let quantity: string;
  if (tokenConfig) {
    const amount = parseFloat(proposal.transfer.amount);
    quantity = `${amount.toFixed(tokenConfig.precision)} ${proposal.transfer.tokenSymbol}`;
  } else {
    quantity = `${proposal.transfer.amount} ${proposal.transfer.tokenSymbol}`;
  }

  return {
    account: DAO_CONTRACT, name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer, dao: daoName, title: proposal.title, description: proposal.description,
      proposal_type: 2,
      choices: [
        { choice: 0, description: "Yes", total_votes: 0 },
        { choice: 1, description: "No", total_votes: 0 },
        { choice: 2, description: "Abstain", total_votes: 0 },
      ],
      actions: [],
      token_receivers: [{
        wax_account: proposal.transfer.recipient,
        quantity, contract: proposal.transfer.tokenContract,
      }],
      nft_receivers: [], proof_asset_ids: [],
    },
  };
}

export function buildNFTTransferProposalAction(
  proposer: string, daoName: string,
  proposal: { title: string; description: string; transfer: NFTTransferProposalData }
) {
  return {
    account: DAO_CONTRACT, name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer, dao: daoName, title: proposal.title, description: proposal.description,
      proposal_type: 3,
      choices: [
        { choice: 0, description: "Yes", total_votes: 0 },
        { choice: 1, description: "No", total_votes: 0 },
        { choice: 2, description: "Abstain", total_votes: 0 },
      ],
      actions: [],
      token_receivers: [],
      nft_receivers: [{ wax_account: proposal.transfer.recipient, asset_ids: proposal.transfer.assetIds }],
      proof_asset_ids: [],
    },
  };
}

// Vote actions
export function buildVoteAction(
  voter: string, daoName: string, proposalId: number,
  vote: "yes" | "no" | "abstain", voteWeight?: string, assetIds?: string[]
) {
  const choiceMap: Record<string, number> = { yes: 0, no: 1, abstain: 2 };
  const data: Record<string, unknown> = {
    user: voter, dao: daoName, proposal_id: proposalId,
    choice: choiceMap[vote], asset_ids: assetIds || [],
  };
  if (voteWeight) data.weight = voteWeight;
  return { account: DAO_CONTRACT, name: "vote", authorization: [{ actor: voter, permission: "active" }], data };
}

export function buildMultiOptionVoteAction(
  voter: string, daoName: string, proposalId: number,
  choiceIndex: number, voteWeight?: string, assetIds?: string[]
) {
  const data: Record<string, unknown> = {
    user: voter, dao: daoName, proposal_id: proposalId,
    choice: choiceIndex, asset_ids: assetIds || [],
  };
  if (voteWeight) data.weight = voteWeight;
  return { account: DAO_CONTRACT, name: "vote", authorization: [{ actor: voter, permission: "active" }], data };
}

export function buildRankedChoiceVoteAction(
  voter: string, daoName: string, proposalId: number,
  choiceIndex: number, voteWeight?: string, assetIds?: string[]
) {
  const data: Record<string, unknown> = {
    user: voter, dao: daoName, proposal_id: proposalId,
    choice: choiceIndex, asset_ids: assetIds || [],
  };
  if (voteWeight) data.weight = voteWeight;
  return { account: DAO_CONTRACT, name: "vote", authorization: [{ actor: voter, permission: "active" }], data };
}

// Staking actions
export function buildStakeTokenActions(staker: string, daoName: string, amount: string, tokenContract: string) {
  return [
    {
      account: DAO_CONTRACT, name: "staketokens",
      authorization: [{ actor: staker, permission: "active" }],
      data: { user: staker, dao: daoName },
    },
    {
      account: tokenContract, name: "transfer",
      authorization: [{ actor: staker, permission: "active" }],
      data: { from: staker, to: DAO_CONTRACT, quantity: amount, memo: `|stake_tokens|${daoName}|` },
    },
  ];
}

export function buildUnstakeTokenAction(staker: string, daoName: string, amount: string) {
  return {
    account: DAO_CONTRACT, name: "unstaketoken",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, dao: daoName, quantity: amount },
  };
}

export function buildStakeNFTAction(staker: string, daoName: string, assetIds: string[]) {
  return {
    account: "atomicassets", name: "transfer",
    authorization: [{ actor: staker, permission: "active" }],
    data: { from: staker, to: DAO_CONTRACT, asset_ids: assetIds, memo: `stake|${daoName}` },
  };
}

export function buildUnstakeNFTAction(staker: string, daoName: string, assetIds: string[]) {
  return {
    account: DAO_CONTRACT, name: "unstakenft",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, daoname: daoName, asset_ids: assetIds },
  };
}

// Treasury deposit actions
export function buildTokenDepositAction(user: string, daoName: string, tokenSymbol: string, tokenPrecision: number, tokenContract: string) {
  return {
    account: DAO_CONTRACT, name: "tokendeposit",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, dao: daoName, token_symbol: `${tokenPrecision},${tokenSymbol}`, token_contract: tokenContract },
  };
}

export function buildDepositToTreasuryAction(sender: string, daoName: string, quantity: string, tokenContract: string) {
  return {
    account: tokenContract, name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: { from: sender, to: DAO_CONTRACT, quantity, memo: `|treasury_deposit|${daoName}|` },
  };
}

export function buildNFTDepositAction(sender: string, daoName: string, assetIds: string[]) {
  return {
    account: DAO_CONTRACT, name: "nftdeposit",
    authorization: [{ actor: sender, permission: "active" }],
    data: { user: sender, dao: daoName, asset_ids: assetIds },
  };
}

export function buildDepositNFTToTreasuryAction(sender: string, daoName: string, assetIds: string[]) {
  return {
    account: "atomicassets", name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: { from: sender, to: DAO_CONTRACT, asset_ids: assetIds, memo: `|treasury_deposit|${daoName}|` },
  };
}

export function buildJoinDaoAction(user: string, daoName: string) {
  return {
    account: DAO_CONTRACT, name: "joindao",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, dao: daoName },
  };
}

export function buildLeaveDaoAction(user: string, daoName: string) {
  return {
    account: DAO_CONTRACT, name: "leavedao",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, dao: daoName },
  };
}
