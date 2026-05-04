// WaxDAO DAO Contract Interface
// Contract: dao.waxdao

import { getTokenConfig } from "@/lib/tokenRegistry";

export const DAO_CONTRACT = "dao.waxdao";

// Fee constants for DAO creation
export const DAO_CREATION_FEE = "265.00000000 WAX";

// Tokens supported as proposal submission fees in the UI.
// The smart contract accepts any asset, but we expose a curated list.
export interface ProposalFeeToken {
  symbol: string;
  contract: string;
  precision: number;
}
export const PROPOSAL_FEE_TOKENS: ProposalFeeToken[] = [
  { symbol: "WAX", contract: "eosio.token", precision: 8 },
  { symbol: "CHEESE", contract: "cheeseburger", precision: 4 },
  { symbol: "WAXDAO", contract: "token.waxdao", precision: 8 },
];

export function findProposalFeeToken(symbol: string): ProposalFeeToken | undefined {
  return PROPOSAL_FEE_TOKENS.find(t => t.symbol === symbol);
}

// Persistent local cache of (symbol -> contract) discovered during DAO creation/edit,
// so proposers can auto-resolve custom tokens picked by the DAO creator.
const FEE_TOKEN_CACHE_KEY = "cheesehub:dao:feeTokenCache";
export function rememberFeeToken(symbol: string, contract: string, precision: number) {
  try {
    const raw = localStorage.getItem(FEE_TOKEN_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[symbol] = { contract, precision };
    localStorage.setItem(FEE_TOKEN_CACHE_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}
export function getCachedFeeToken(symbol: string): { contract: string; precision: number } | null {
  try {
    const raw = localStorage.getItem(FEE_TOKEN_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[symbol] ?? null;
  } catch { return null; }
}

/**
 * Resolve a token's precision by calling get_currency_stats.
 * Returns null if the contract/symbol does not exist.
 */
export async function resolveTokenStats(contract: string, symbol: string): Promise<{ precision: number } | null> {
  const { waxRpcCall } = await import("@/lib/waxRpcFallback");
  try {
    const data = await waxRpcCall<Record<string, { supply?: string }>>(
      "/v1/chain/get_currency_stats",
      { code: contract, symbol },
      6000,
    );
    const entry = data?.[symbol];
    if (!entry?.supply) return null;
    const supply = entry.supply.split(" ")[0] || "";
    const precision = supply.includes(".") ? supply.split(".")[1].length : 0;
    return { precision };
  } catch {
    return null;
  }
}

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
  4: "executed", 5: "rejected", 6: "expired",
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

// --- Fetch functions ---

interface DaoProfile {
  dao_name: string;
  description: string;
  avatar: string;
  cover_image: string;
  socials?: DaoSocials;
}

async function fetchDaoProfiles(): Promise<Map<string, DaoProfile>> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true, code: DAO_CONTRACT, scope: DAO_CONTRACT,
        table: "daoprofiles", limit: 100,
      }),
    });
    const data = await response.json();
    const profiles = new Map<string, DaoProfile>();
    for (const row of data.rows || []) {
      const daoName = (row.dao_name || row.daoname) as string;
      const profile = row.profile as { description?: string; avatar?: string; cover_image?: string } | undefined;
      const socials = row.socials as DaoSocials | undefined;
      profiles.set(daoName, {
        dao_name: daoName,
        description: (profile?.description || "") as string,
        avatar: (profile?.avatar || "") as string,
        cover_image: (profile?.cover_image || "") as string,
        socials: socials || {},
      });
    }
    return profiles;
  } catch (error) {
    console.error("Error fetching DAO profiles:", error);
    return new Map();
  }
}

export async function fetchAllDaos(): Promise<DaoInfo[]> {
  try {
    const [daoResponse, profiles] = await Promise.all([
      fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: DAO_CONTRACT, scope: DAO_CONTRACT,
          table: "daos", limit: 100,
        }),
      }),
      fetchDaoProfiles()
    ]);
    const data = await daoResponse.json();
    return (data.rows || []).map((row: Record<string, unknown>) => {
      const daoName = row.daoname as string || "";
      const profile = profiles.get(daoName);
      return {
        dao_name: daoName,
        creator: row.creator as string || "",
        description: profile?.description || "",
        logo: profile?.avatar || "",
        cover_image: profile?.cover_image || "",
        token_contract: row.gov_token_contract as string || "",
        token_symbol: row.gov_token_symbol as string || "",
        dao_type: row.dao_type as number || 0,
        proposer_type: row.proposer_type as number || 0,
        threshold: parseFloat(row.threshold as string) || 0,
        hours_per_proposal: row.hours_per_proposal as number || 0,
        minimum_weight: typeof row.minimum_weight === 'string'
          ? parseInt(row.minimum_weight) : row.minimum_weight as number || 0,
        minimum_votes: row.minimum_votes as number || 0,
        proposal_cost: row.proposal_cost as string || "0",
        authors: row.authors as string[] || [],
        gov_schemas: row.gov_schemas as { collection_name: string; schema_name: string }[] || [],
        time_created: row.time_created as number || 0,
        status: row.status as number || 0,
        socials: profile?.socials,
      };
    });
  } catch (error) {
    console.error("Error fetching DAOs:", error);
    return [];
  }
}

export async function fetchDaoDetails(daoName: string): Promise<DaoInfo | null> {
  try {
    const allDaos = await fetchAllDaos();
    return allDaos.find(dao => dao.dao_name === daoName) || null;
  } catch (error) {
    console.error("Error fetching DAO details:", error);
    return null;
  }
}

// Helper to fetch user's NFT collections for Type 5 DAO eligibility check
async function fetchUserNftCollections(account: string): Promise<Set<string>> {
  const collections = new Set<string>();
  let lower_bound = '';
  let hasMore = true;
  try {
    while (hasMore) {
      const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: "atomicassets", scope: account,
          table: "assets", limit: 1000, lower_bound,
        }),
      });
      const data = await response.json();
      for (const asset of data.rows || []) {
        collections.add(`${asset.collection_name}:${asset.schema_name}`);
      }
      hasMore = data.more && data.rows?.length > 0;
      if (hasMore && data.rows.length > 0) {
        lower_bound = String(BigInt(data.rows[data.rows.length - 1].asset_id) + 1n);
      }
    }
  } catch (error) {
    console.error("Error fetching user NFT collections:", error);
  }
  return collections;
}

// Fetch DAOs where user is a member
export async function fetchUserDaos(account: string): Promise<DaoInfo[]> {
  try {
    const [stakedResponse, stakedNftResponse, allDaos, userNftCollections] = await Promise.all([
      fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: DAO_CONTRACT, scope: account,
          table: "stakedtokens", limit: 100,
        }),
      }),
      fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: DAO_CONTRACT, scope: account,
          table: "stakedassets", limit: 100,
        }),
      }),
      fetchAllDaos(),
      fetchUserNftCollections(account),
    ]);

    const stakedData = await stakedResponse.json();
    const stakedNftData = await stakedNftResponse.json();

    const stakedDaoNames = new Set<string>();
    for (const row of stakedData.rows || []) {
      const daoName = row.dao_name || row.daoname || row.dao;
      if (daoName) stakedDaoNames.add(daoName);
    }
    for (const row of stakedNftData.rows || []) {
      const daoName = row.dao_name || row.daoname || row.dao;
      if (daoName) stakedDaoNames.add(daoName);
    }

    return allDaos.filter(dao => {
      if (stakedDaoNames.has(dao.dao_name)) return true;
      if (dao.dao_type === 5 && dao.gov_schemas?.length > 0) {
        return dao.gov_schemas.some(schema =>
          userNftCollections.has(`${schema.collection_name}:${schema.schema_name}`)
        );
      }
      return false;
    });
  } catch (error) {
    console.error("Error fetching user DAOs:", error);
    return [];
  }
}

// Fetch token_receivers from Hyperion history API
async function fetchTokenReceiversFromHyperion(
  daoName: string
): Promise<Record<string, TokenReceiver[]>> {
  const result: Record<string, TokenReceiver[]> = {};
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v2/history/get_actions?account=${DAO_CONTRACT}&filter=${DAO_CONTRACT}:newproposal&limit=500`
    );
    if (!response.ok) return result;
    const data = await response.json();
    for (const action of data.actions || []) {
      const actData = action.act?.data;
      if (actData && actData.dao === daoName && actData.proposal_type === 4) {
        if (actData.token_receivers && actData.token_receivers.length > 0) {
          const title = (actData.title as string) || "";
          result[title] = actData.token_receivers.map((tr: Record<string, unknown>) => ({
            wax_account: (tr.wax_account as string) || "",
            quantity: (tr.quantity as string) || "",
            contract: (tr.contract as string) || "eosio.token",
          }));
        }
      }
    }
    return result;
  } catch (error) {
    console.error("Hyperion fetch error:", error);
    return result;
  }
}

// Fetch proposals for a DAO
export async function fetchProposals(daoName: string): Promise<Proposal[]> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true, code: DAO_CONTRACT, scope: daoName,
        table: "proposals", limit: 100,
      }),
    });

    const data = await response.json();
    const now = Math.floor(Date.now() / 1000);

    // Check if token transfer proposals need Hyperion data
    const hasTokenTransferProposals = (data.rows || []).some((row: Record<string, unknown>) => {
      const pType = row.proposal_type as number;
      const receivers = row.token_receivers as unknown[];
      return pType === 4 && (!receivers || receivers.length === 0);
    });

    let hyperionReceiversByTitle: Record<string, TokenReceiver[]> = {};
    if (hasTokenTransferProposals) {
      hyperionReceiversByTitle = await fetchTokenReceiversFromHyperion(daoName);
    }

    return (data.rows || []).map((row: Record<string, unknown>) => {
      const choices = row.choices as ProposalChoice[] || [];
      const outcome = typeof row.outcome === 'number' ? row.outcome : 0;
      const endTime = row.end_time as number || 0;
      const contractProposalType = (row.proposal_type as number) ?? 0;

      let yesVotes = 0, noVotes = 0, abstainVotes = 0;
      choices.forEach((choice: ProposalChoice) => {
        const votes = typeof choice.total_votes === 'string'
          ? parseInt(choice.total_votes) || 0 : choice.total_votes || 0;
        const choiceDesc = choice.description?.toLowerCase();
        if (choiceDesc === "yes") yesVotes = votes;
        else if (choiceDesc === "no") noVotes = votes;
        else if (choiceDesc === "abstain") abstainVotes = votes;
      });

      let status: Proposal["status"] = "pending";

      if (outcome === 2 || outcome === 4 || outcome === 5) {
        if (contractProposalType === 4) {
          if (yesVotes === 0 && noVotes === 0) {
            status = abstainVotes > 0 ? "inconclusive" : "rejected";
          } else {
            status = outcome === 4 ? "executed" : (yesVotes > noVotes ? "passed" : "rejected");
          }
        } else if (contractProposalType === 0 || contractProposalType === 1) {
          const totalChoiceVotes = choices.reduce((sum: number, c: ProposalChoice) => {
            return sum + (typeof c.total_votes === 'string' ? parseInt(c.total_votes) || 0 : c.total_votes || 0);
          }, 0);
          status = outcome === 4 ? "executed" : (totalChoiceVotes > 0 ? "passed" : "rejected");
        } else {
          status = outcome === 4 ? "executed" : "passed";
        }
      } else if (outcome === 3) {
        status = "rejected";
      } else if (outcome >= 6) {
        status = (OUTCOME_STATUS[outcome] as typeof status) || "rejected";
      } else {
        if (endTime > now) {
          status = "active";
        } else if (endTime <= now) {
          if ((contractProposalType === 0 || contractProposalType === 1) && outcome === 1) {
            const totalChoiceVotes = choices.reduce((sum: number, c: ProposalChoice) => {
              return sum + (typeof c.total_votes === 'string' ? parseInt(c.total_votes) || 0 : c.total_votes || 0);
            }, 0);
            status = totalChoiceVotes > 0 ? "passed" : "rejected";
          } else {
            status = now - endTime > EXPIRY_THRESHOLD ? "expired" : "pending";
          }
        }
      }

      const actions = (row.actions as ProposalAction[]) || [];

      let votingType: number;
      switch (contractProposalType) {
        case 0: votingType = PROPOSAL_VOTING_TYPES.MOST_VOTES_WINS; break;
        case 1: votingType = PROPOSAL_VOTING_TYPES.RANKED_CHOICE; break;
        case 2: votingType = PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER; break;
        case 3: votingType = PROPOSAL_VOTING_TYPES.NFT_TRANSFER; break;
        case 4: votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN; break;
        default: votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN;
      }

      if (votingType === PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN && actions.some(a => a.action === "transfer")) {
        votingType = PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER;
      }

      // Get token_receivers
      let tokenReceivers: TokenReceiver[] = [];
      const nftReceivers = (row.nft_receivers as NFTReceiver[]) || [];

      if (row.token_receivers) {
        if (Array.isArray(row.token_receivers) && row.token_receivers.length > 0) {
          tokenReceivers = row.token_receivers as TokenReceiver[];
        } else if (typeof row.token_receivers === 'object') {
          const tr = row.token_receivers as Record<string, unknown>;
          if (tr.wax_account && tr.quantity) {
            tokenReceivers = [{
              wax_account: tr.wax_account as string,
              quantity: tr.quantity as string,
              contract: (tr.contract as string) || 'eosio.token',
            }];
          }
        }
      }

      // Fallback to Hyperion for token transfer proposals
      if (tokenReceivers.length === 0 && votingType === PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER) {
        const transferActions = actions.filter(a => a.action === "transfer");
        if (transferActions.length > 0) {
          tokenReceivers = transferActions.map(action => {
            const d = action.data as Record<string, unknown>;
            return {
              wax_account: (d.to as string) || "",
              quantity: (d.quantity as string) || "",
              contract: action.contract || "eosio.token",
            };
          }).filter(r => r.wax_account && r.quantity);
        }
        if (tokenReceivers.length === 0) {
          const proposalTitle = (row.title as string) || "";
          const hyperionReceivers = hyperionReceiversByTitle[proposalTitle];
          if (hyperionReceivers && hyperionReceivers.length > 0) {
            tokenReceivers = hyperionReceivers;
          }
        }
      }

      return {
        proposal_id: (row.proposal_id as number) || (row.id as number) || 0,
        dao_name: daoName,
        proposer: (row.author as string) || (row.proposer as string) || "",
        title: (row.title as string) || "",
        description: ((row.description as string) || "").replace(/^\[RANKED\]\s*/, ""),
        proposal_type: String(contractProposalType),
        voting_type: votingType,
        status,
        yes_votes: yesVotes,
        no_votes: noVotes,
        abstain_votes: abstainVotes,
        choices,
        start_time: (row.start_time as string) || "",
        end_time: endTime.toString(),
        end_time_ts: endTime,
        total_votes: (row.total_votes as number) || 0,
        actions,
        token_receivers: tokenReceivers,
        nft_receivers: nftReceivers,
      };
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
}

// Fetch treasury balances
export async function fetchDaoTreasury(daoName: string): Promise<TreasuryBalance[]> {
  const balances: TreasuryBalance[] = [];
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: DAO_CONTRACT, table: "tokenvault", scope: daoName, limit: 100, json: true,
      }),
    });
    const data = await response.json();
    if (data.rows && Array.isArray(data.rows)) {
      for (const row of data.rows) {
        const balanceStr = typeof row.balance === 'string' ? row.balance : row.balance?.quantity || '';
        if (balanceStr) {
          const [amountStr, symbol] = balanceStr.split(" ");
          const amount = parseFloat(amountStr);
          const precision = amountStr.includes(".") ? amountStr.split(".")[1].length : 0;
          const contract = row.contract || row.balance?.contract ||
            (symbol === 'WAX' ? 'eosio.token' : symbol === 'WAXDAO' ? 'token.waxdao' : 'unknown');
          if (amount > 0) {
            balances.push({ contract, symbol, amount, precision });
          }
        }
      }
    }
    return balances;
  } catch (error) {
    console.error("Error fetching treasury:", error);
    return [];
  }
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

  return {
    account: DAO_CONTRACT,
    name: "createdao",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      user: creator,
      daoname: config.daoName,
      dao_type: daoType,
      gov_token_contract: useToken ? (config.tokenContract || "") : "",
      gov_token_symbol: useToken ? (config.tokenSymbol || "") : "",
      gov_farm_name: useFarm ? (config.govFarmName || "null") : "null",
      gov_schemas: useSchemas ? (config.govSchemas || []) : [],
      threshold: config.threshold || 50.0,
      hours_per_proposal: config.hoursPerProposal || 72,
      minimum_weight: config.minimumWeight || 0,
      minimum_votes: config.minimumVotes || 1,
      proposer_type: config.proposerType || 1,
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

// Fetch voted NFTs for a proposal
export async function fetchVotedNFTs(proposalId: number): Promise<string[]> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true, code: DAO_CONTRACT, scope: proposalId.toString(),
        table: "votesbynft", limit: 1000,
      }),
    });
    const data = await response.json();
    return (data.rows || []).map((row: { asset_id: string }) => row.asset_id);
  } catch (error) {
    console.error("Error fetching voted NFTs:", error);
    return [];
  }
}

// Fetch user's staked tokens
export async function fetchUserStakedTokens(daoName: string, userAccount: string): Promise<StakedToken | null> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true, code: DAO_CONTRACT, scope: userAccount,
        table: "stakedtokens", lower_bound: daoName, upper_bound: daoName, limit: 1,
      }),
    });
    const data = await response.json();
    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      const balanceStr = row.balance || "0";
      const balanceParts = balanceStr.split(" ");
      const amount = parseFloat(balanceParts[0]) || 0;
      const precision = balanceParts[0].includes(".") ? balanceParts[0].split(".")[1].length : 0;
      const weight = Math.floor(amount * Math.pow(10, precision));
      return { balance: balanceStr, weight };
    }
    return null;
  } catch (error) {
    console.error("Error fetching staked tokens:", error);
    return null;
  }
}

// Fetch user's vote for a specific proposal
export async function fetchUserVote(
  daoName: string, proposalId: number, userAccount: string
): Promise<UserVote | null> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true, code: DAO_CONTRACT, scope: proposalId.toString(),
        table: "votesbyprop", lower_bound: userAccount, upper_bound: userAccount, limit: 1,
      }),
    });
    const data = await response.json();
    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      const hasChoiceInfo = row.choice !== undefined || row.choice_index !== undefined;
      return {
        choice_index: hasChoiceInfo ? (row.choice ?? row.choice_index) as number : -1,
        weight: parseInt(String(row.weight || row.vote_weight || 0)) || 0,
        rankings: (row.rankings || row.ranked_choices) as number[] | undefined,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching user vote:", error);
    return null;
  }
}

// Fetch user's staked NFTs
export async function fetchUserStakedNFTs(daoName: string, userAccount: string): Promise<StakedNFT[]> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true, code: DAO_CONTRACT, scope: daoName,
        table: "stakednfts", lower_bound: userAccount, upper_bound: userAccount,
        index_position: 2, key_type: "name", limit: 100,
      }),
    });
    const data = await response.json();
    const stakedNFTs: StakedNFT[] = [];
    if (data.rows && data.rows.length > 0) {
      for (const row of data.rows) {
        const assetId = row.asset_id?.toString() || row.asset_ids?.[0]?.toString();
        if (assetId) {
          try {
            const assetResponse = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets/${assetId}`);
            const assetData = await assetResponse.json();
            if (assetData.success && assetData.data) {
              const asset = assetData.data;
              stakedNFTs.push({
                asset_id: assetId,
                name: asset.data?.name || asset.name || `NFT #${assetId}`,
                image: asset.data?.img || asset.data?.image || "",
                collection: asset.collection?.collection_name || "",
                schema: asset.schema?.schema_name || "",
              });
            }
          } catch { console.log(`Could not fetch asset ${assetId}`); }
        }
      }
    }
    return stakedNFTs;
  } catch (error) {
    console.error("Error fetching staked NFTs:", error);
    return [];
  }
}

// Fetch user's token balance
export async function fetchUserTokenBalance(contract: string, symbol: string, userAccount: string): Promise<string> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_currency_balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: contract, account: userAccount, symbol }),
    });
    const data = await response.json();
    if (data.error || data.code === 500) {
      return await fetchUserTokenBalanceFromTable(contract, symbol, userAccount);
    }
    if (Array.isArray(data) && data.length > 0) return data[0];
    return `0 ${symbol}`;
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return await fetchUserTokenBalanceFromTable(contract, symbol, userAccount);
  }
}

async function fetchUserTokenBalanceFromTable(contract: string, symbol: string, userAccount: string): Promise<string> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: contract, scope: userAccount, table: "accounts", limit: 100, json: true,
      }),
    });
    const data = await response.json();
    if (data.rows && data.rows.length > 0) {
      for (const row of data.rows) {
        const balance = row.balance || row.quantity;
        if (balance && balance.includes(symbol)) return balance;
      }
    }
    return `0 ${symbol}`;
  } catch { return `0 ${symbol}`; }
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

// Treasury NFTs
const ATOMIC_API_ENDPOINTS = [
  'https://aa.wax.blacklusion.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://wax.api.atomicassets.io',
];

async function fetchFromAtomicAPI(path: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const baseUrl of ATOMIC_API_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      if (response.ok) return response;
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw lastError || new Error('All AtomicAssets API endpoints failed');
}

async function fetchTreasuryAssetIds(daoName: string): Promise<string[]> {
  try {
    const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: DAO_CONTRACT, scope: daoName, table: "nftvault", limit: 1000, json: true,
      }),
    });
    const json = await response.json();
    if (!json.rows || json.rows.length === 0) return [];
    return json.rows.map((row: Record<string, unknown>) =>
      String(row.asset_id || row.assetid || row.id || "")
    ).filter((id: string) => id !== "");
  } catch (error) {
    console.error("Error fetching treasury asset IDs:", error);
    return [];
  }
}

export async function fetchDaoTreasuryNFTs(daoName: string): Promise<TreasuryNFT[]> {
  try {
    const assetIds = await fetchTreasuryAssetIds(daoName);
    if (assetIds.length === 0) return [];

    const response = await fetchFromAtomicAPI(`/atomicassets/v1/assets?ids=${assetIds.join(",")}&limit=1000`);
    const json = await response.json();
    if (!json.success || !json.data) return [];

    return json.data.map((asset: Record<string, unknown>) => {
      const data = asset.data as Record<string, string> || {};
      const collection = asset.collection as { collection_name: string } || { collection_name: "" };
      const schema = asset.schema as { schema_name: string } || { schema_name: "" };
      const template = asset.template as { template_id: string } || { template_id: "" };

      let image = data.img || data.image || "";
      if (image && !image.startsWith("http")) {
        if (image.startsWith("Qm") || image.startsWith("bafy")) {
          image = `https://ipfs.io/ipfs/${image}`;
        }
      }

      return {
        asset_id: asset.asset_id as string,
        name: data.name || (asset.name as string) || `NFT #${asset.asset_id}`,
        image, collection: collection.collection_name,
        schema: schema.schema_name, template_id: template.template_id,
      };
    });
  } catch (error) {
    console.error("Error fetching treasury NFTs:", error);
    return [];
  }
}

// Membership check
export async function checkDaoMembership(daoName: string, user: string): Promise<boolean> {
  try {
    const [stakedResponse, stakedNftsResponse] = await Promise.all([
      fetch("https://wax.eosusa.io/v1/chain/get_table_rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: DAO_CONTRACT, scope: user, table: "stakedtokens", limit: 100,
        }),
      }),
      fetch("https://wax.eosusa.io/v1/chain/get_table_rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: DAO_CONTRACT, scope: user, table: "stakedassets", limit: 100,
        }),
      }),
    ]);

    const [stakedData, stakedNftsData] = await Promise.all([
      stakedResponse.json(), stakedNftsResponse.json(),
    ]);

    if (stakedData.rows && stakedData.rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasStakedToDao = stakedData.rows.some((row: any) => {
        const rowDao = row.dao_name || row.daoname || row.dao;
        if (rowDao !== daoName) return false;
        const balance = row.balance || "0";
        return parseFloat(balance.split(" ")[0]) > 0;
      });
      if (hasStakedToDao) return true;
    }

    if (stakedNftsData.rows && stakedNftsData.rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasStakedNfts = stakedNftsData.rows.some((row: any) => {
        const rowDao = row.dao_name || row.daoname || row.dao;
        return rowDao === daoName;
      });
      if (hasStakedNfts) return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to check DAO membership:", error);
    return false;
  }
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
