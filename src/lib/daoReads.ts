// CHEESEDao chain and API reads.
// Import from "@/lib/dao" (stable entry point), not this file directly.

import { fetchWithFallback } from "@/lib/fetchWithFallback";
import { fetchActionsUnion } from "@/lib/hyperionHistory";
import { resolveEndpoints } from './endpointHealth';
import {
  DAO_CONTRACT, EXPIRY_THRESHOLD, OUTCOME_STATUS, PROPOSAL_VOTING_TYPES,
  type DaoInfo, type DaoSocials, type Proposal, type ProposalAction, type ProposalChoice,
  type TokenReceiver, type NFTReceiver, type TreasuryBalance, type TreasuryNFT,
  type StakedToken, type StakedNFT, type UserVote,
} from "./daoModel";

// Chain reads fail over across the shared HerdCheck health-ordered node list.
async function daoRpcFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetchWithFallback(await resolveEndpoints('chain-api'), path, init, 10000);
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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
      daoRpcFetch(`/v1/chain/get_table_rows`, {
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
      const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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
      daoRpcFetch(`/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: DAO_CONTRACT, scope: account,
          table: "stakedtokens", limit: 100,
        }),
      }),
      daoRpcFetch(`/v1/chain/get_table_rows`, {
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
    const { actions } = await fetchActionsUnion(
      `account=${DAO_CONTRACT}&filter=${DAO_CONTRACT}:newproposal`,
      { batchSize: 500, maxActions: 10000, timeoutMs: 10000 },
    );
    for (const action of actions) {
      const actData = action.act?.data as Record<string, unknown> | undefined;
      if (actData && actData.dao === daoName && actData.proposal_type === 4) {
        const receivers = actData.token_receivers as Array<Record<string, unknown>> | undefined;
        if (receivers && receivers.length > 0) {
          const title = (actData.title as string) || "";
          result[title] = receivers.map((tr) => ({
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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


// Fetch voted NFTs for a proposal
export async function fetchVotedNFTs(proposalId: number): Promise<string[]> {
  try {
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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
      // Integer parse of the asset string: float multiply lost a unit (12.3456 → 123455).
      const [whole = "0", frac = ""] = (balanceParts[0] || "0").split(".");
      const weight = Number(`${whole.replace(/^-/, "")}${frac}`.replace(/^0+(?=\d)/, "")) || 0;
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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
            const assetResponse = await fetchFromAtomicAPI(`/atomicassets/v1/assets/${assetId}`);
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
    const response = await daoRpcFetch(`/v1/chain/get_currency_balance`, {
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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

// Treasury NFTs
const ATOMIC_API_ENDPOINTS = [
  'https://aa.wax.blacklusion.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://wax.api.atomicassets.io',
];

async function fetchFromAtomicAPI(path: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const baseUrl of await resolveEndpoints('atomic-assets-api', ATOMIC_API_ENDPOINTS)) {
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
    const response = await daoRpcFetch(`/v1/chain/get_table_rows`, {
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

      // Raw value: DaoTreasurySection resolves it through the shared gateway list.
      const image = data.img || data.image || "";

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
      daoRpcFetch("/v1/chain/get_table_rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true, code: DAO_CONTRACT, scope: user, table: "stakedtokens", limit: 100,
        }),
      }),
      daoRpcFetch("/v1/chain/get_table_rows", {
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
