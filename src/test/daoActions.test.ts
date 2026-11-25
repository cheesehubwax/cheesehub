import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tokenRegistry", () => ({
  getTokenConfig: (s: string) => (s === "WAX" ? { precision: 8 } : s === "CHEESE" ? { precision: 4 } : undefined),
}));

import * as dao from "@/lib/dao";

const auth = (actor: string) => [{ actor, permission: "active" }];
const YNA = [
  { choice: 0, description: "Yes", total_votes: 0 },
  { choice: 1, description: "No", total_votes: 0 },
  { choice: 2, description: "Abstain", total_votes: 0 },
];

describe("DAO fees", () => {
  it("DAO creation fee is 265 WAX paid to dao.waxdao with dao_payment memo", () => {
    expect(dao.DAO_CONTRACT).toBe("dao.waxdao");
    expect(dao.DAO_CREATION_FEE).toBe("265.00000000 WAX");
    expect(dao.buildDaoCreationFeeAction("alice")).toEqual({
      account: "eosio.token", name: "transfer", authorization: auth("alice"),
      data: { from: "alice", to: "dao.waxdao", quantity: "265.00000000 WAX", memo: "|dao_payment|" },
    });
  });
  it("proposal cost transfer defaults to eosio.token and supports custom token contracts", () => {
    expect(dao.buildProposalCostAction("bob", "10.0000 CHEESE", "cheeseburger")).toEqual({
      account: "cheeseburger", name: "transfer", authorization: auth("bob"),
      data: { from: "bob", to: "dao.waxdao", quantity: "10.0000 CHEESE", memo: "|proposal_payment|" },
    });
    expect(dao.buildProposalCostAction("bob", "1.00000000 WAX").account).toBe("eosio.token");
  });
  it("curated fee token list and lookup", () => {
    expect(dao.PROPOSAL_FEE_TOKENS).toEqual([
      { symbol: "WAX", contract: "eosio.token", precision: 8 },
      { symbol: "CHEESE", contract: "cheeseburger", precision: 4 },
      { symbol: "WAXDAO", contract: "token.waxdao", precision: 8 },
    ]);
    expect(dao.findProposalFeeToken("CHEESE")?.contract).toBe("cheeseburger");
    expect(dao.findProposalFeeToken("NOPE")).toBeUndefined();
  });
  it("remembers custom fee tokens in local storage", () => {
    localStorage.clear();
    expect(dao.getCachedFeeToken("ABC")).toBeNull();
    dao.rememberFeeToken("ABC", "abc.token", 3);
    expect(dao.getCachedFeeToken("ABC")).toEqual({ contract: "abc.token", precision: 3 });
  });
});

describe("DAO simple actions", () => {
  it("dao.waxdao helper actions", () => {
    expect(dao.buildAnnounceDepoAction("u")).toEqual({ account: "dao.waxdao", name: "announcedepo", authorization: auth("u"), data: { user: "u" } });
    expect(dao.buildAssertPointAction("u")).toEqual({ account: "dao.waxdao", name: "assertpoint", authorization: auth("u"), data: { user: "u" } });
    expect(dao.buildFinalizeProposalAction("u", "d", 3)).toEqual({ account: "dao.waxdao", name: "finalize", authorization: auth("u"), data: { user: "u", dao: "d", proposal_id: 3 } });
    expect(dao.buildRecountProposalAction("u", "d", 3)).toEqual({ account: "dao.waxdao", name: "recount", authorization: auth("u"), data: { user: "u", dao: "d", proposal_id: 3 } });
    expect(dao.buildClaimVoteRamAction("u", "d", 3)).toEqual({ account: "dao.waxdao", name: "claimvoteram", authorization: auth("u"), data: { user: "u", dao: "d", proposal_id: 3, skip: 0, max: 100 } });
    expect(dao.buildEditPropCostAction("u", "d", "5.0000 CHEESE")).toEqual({ account: "dao.waxdao", name: "editpropcost", authorization: auth("u"), data: { user: "u", dao: "d", proposal_cost: "5.0000 CHEESE" } });
    expect(dao.buildJoinDaoAction("u", "d")).toEqual({ account: "dao.waxdao", name: "joindao", authorization: auth("u"), data: { user: "u", dao: "d" } });
    expect(dao.buildLeaveDaoAction("u", "d")).toEqual({ account: "dao.waxdao", name: "leavedao", authorization: auth("u"), data: { user: "u", dao: "d" } });
  });
});

describe("createdao", () => {
  it("token DAO with defaults", () => {
    expect(dao.buildCreateDaoAction("c", { daoName: "mydao", tokenContract: " cheeseburger ", tokenSymbol: "cheese" })).toEqual({
      account: "dao.waxdao", name: "createdao", authorization: auth("c"),
      data: {
        user: "c", daoname: "mydao", dao_type: 4, gov_token_contract: "cheeseburger", gov_token_symbol: "8,CHEESE",
        gov_farm_name: "null", gov_schemas: [], threshold: 50, hours_per_proposal: 72, minimum_weight: 0,
        minimum_votes: 1, proposer_type: 1, authors: [], proposal_cost: "0.00000000 WAX",
      },
    });
  });
  it("keeps explicit precision, Authors Only (0) and custom fee token", () => {
    const a = dao.buildCreateDaoAction("c", { daoName: "d", tokenContract: "x", tokenSymbol: "4, cheese", proposerType: 0, proposalCost: 2, proposalCostSymbol: "CHEESE", proposalCostPrecision: 4 });
    expect(a.data.gov_token_symbol).toBe("4,CHEESE");
    expect(a.data.proposer_type).toBe(0);
    expect(a.data.proposal_cost).toBe("2.0000 CHEESE");
  });
  it("hold-NFT DAO uses NULL token sentinels and schemas", () => {
    const schemas = [{ collection_name: "col", schema_name: "sch" }];
    const a = dao.buildCreateDaoAction("c", { daoName: "d", daoType: 5, tokenSymbol: "X", govSchemas: schemas });
    expect(a.data).toMatchObject({ dao_type: 5, gov_token_contract: "null", gov_token_symbol: "0,NULL", gov_farm_name: "null", gov_schemas: schemas });
  });
});

describe("profile actions", () => {
  const empty = { atomichub: "", discord: "", medium: "", telegram: "", twitter: "", waxdao: "", website: "", youtube: "" };
  it("setprofile without socials", () => {
    expect(dao.buildSetProfileAction("u", "d", "desc")).toEqual({
      account: "dao.waxdao", name: "setprofile", authorization: auth("u"),
      data: { user: "u", dao: "d", profile: { avatar: "", cover_image: "", description: "desc" }, socials: empty },
    });
  });
  it("setprofile with socials", () => {
    const a = dao.buildSetProfileActionWithSocials("u", "d", "x", "av", "cv", { twitter: "t", website: "w" });
    expect(a.data).toEqual({ user: "u", dao: "d", profile: { avatar: "av", cover_image: "cv", description: "x" }, socials: { ...empty, twitter: "t", website: "w" } });
  });
});

describe("proposal actions", () => {
  const base = { user: "p", dao: "d", title: "T", description: "D" };
  it("yes/no/abstain = type 4", () => {
    expect(dao.buildCreateProposalAction("p", "d", { title: "T", description: "D", proposalType: "x" })).toEqual({
      account: "dao.waxdao", name: "newproposal", authorization: auth("p"),
      data: { ...base, proposal_type: 4, choices: YNA, actions: [], token_receivers: [], nft_receivers: [], proof_asset_ids: [] },
    });
  });
  it("multi option = type 0, ranked = type 1", () => {
    const choices = [{ choice: 0, description: "A", total_votes: 0 }, { choice: 1, description: "B", total_votes: 0 }];
    expect(dao.buildMultiOptionProposalAction("p", "d", { title: "T", description: "D", options: ["A", "B"] }).data).toEqual({ ...base, proposal_type: 0, choices, actions: [], token_receivers: [], nft_receivers: [], proof_asset_ids: [] });
    expect(dao.buildRankedChoiceProposalAction("p", "d", { title: "T", description: "D", options: ["A", "B"] }).data).toEqual({ ...base, proposal_type: 1, choices, actions: [], token_receivers: [], nft_receivers: [], proof_asset_ids: [] });
  });
  it("token transfer = type 2 with registry precision", () => {
    const a = dao.buildTokenTransferProposalAction("p", "d", { title: "T", description: "D", transfer: { recipient: "r", amount: "1.5", tokenSymbol: "CHEESE", tokenContract: "cheeseburger" } });
    expect(a.data).toEqual({ ...base, proposal_type: 2, choices: YNA, actions: [], token_receivers: [{ wax_account: "r", quantity: "1.5000 CHEESE", contract: "cheeseburger" }], nft_receivers: [], proof_asset_ids: [] });
    const u = dao.buildTokenTransferProposalAction("p", "d", { title: "T", description: "D", transfer: { recipient: "r", amount: "7.1", tokenSymbol: "ZZZ", tokenContract: "z" } });
    expect(u.data.token_receivers[0].quantity).toBe("7.1 ZZZ");
  });
  it("NFT transfer = type 3", () => {
    expect(dao.buildNFTTransferProposalAction("p", "d", { title: "T", description: "D", transfer: { recipient: "r", assetIds: ["1", "2"] } }).data).toEqual({
      ...base, proposal_type: 3, choices: YNA, actions: [], token_receivers: [], nft_receivers: [{ wax_account: "r", asset_ids: ["1", "2"] }], proof_asset_ids: [],
    });
  });
});

describe("vote actions", () => {
  it("yes/no/abstain map to 0/1/2, weight only when given", () => {
    expect(dao.buildVoteAction("v", "d", 1, "no")).toEqual({ account: "dao.waxdao", name: "vote", authorization: auth("v"), data: { user: "v", dao: "d", proposal_id: 1, choice: 1, asset_ids: [] } });
    expect(dao.buildVoteAction("v", "d", 1, "abstain", "5", ["9"]).data).toEqual({ user: "v", dao: "d", proposal_id: 1, choice: 2, asset_ids: ["9"], weight: "5" });
    expect(dao.buildMultiOptionVoteAction("v", "d", 1, 3).data).toEqual({ user: "v", dao: "d", proposal_id: 1, choice: 3, asset_ids: [] });
    expect(dao.buildRankedChoiceVoteAction("v", "d", 1, 2, "7").data).toEqual({ user: "v", dao: "d", proposal_id: 1, choice: 2, asset_ids: [], weight: "7" });
  });
});

describe("staking and treasury actions", () => {
  it("stake tokens = staketokens then transfer with memo", () => {
    expect(dao.buildStakeTokenActions("s", "d", "1.0000 CHEESE", "cheeseburger")).toEqual([
      { account: "dao.waxdao", name: "staketokens", authorization: auth("s"), data: { user: "s", dao: "d" } },
      { account: "cheeseburger", name: "transfer", authorization: auth("s"), data: { from: "s", to: "dao.waxdao", quantity: "1.0000 CHEESE", memo: "|stake_tokens|d|" } },
    ]);
  });
  it("unstake / NFT stake / unstake", () => {
    expect(dao.buildUnstakeTokenAction("s", "d", "1 X")).toEqual({ account: "dao.waxdao", name: "unstaketoken", authorization: auth("s"), data: { user: "s", dao: "d", quantity: "1 X" } });
    expect(dao.buildStakeNFTAction("s", "d", ["1"])).toEqual({ account: "atomicassets", name: "transfer", authorization: auth("s"), data: { from: "s", to: "dao.waxdao", asset_ids: ["1"], memo: "stake|d" } });
    expect(dao.buildUnstakeNFTAction("s", "d", ["1"])).toEqual({ account: "dao.waxdao", name: "unstakenft", authorization: auth("s"), data: { user: "s", daoname: "d", asset_ids: ["1"] } });
  });
  it("treasury deposits", () => {
    expect(dao.buildTokenDepositAction("u", "d", "CHEESE", 4, "cheeseburger")).toEqual({ account: "dao.waxdao", name: "tokendeposit", authorization: auth("u"), data: { user: "u", dao: "d", token_symbol: "4,CHEESE", token_contract: "cheeseburger" } });
    expect(dao.buildDepositToTreasuryAction("u", "d", "1.0000 CHEESE", "cheeseburger")).toEqual({ account: "cheeseburger", name: "transfer", authorization: auth("u"), data: { from: "u", to: "dao.waxdao", quantity: "1.0000 CHEESE", memo: "|treasury_deposit|d|" } });
    expect(dao.buildNFTDepositAction("u", "d", ["1"])).toEqual({ account: "dao.waxdao", name: "nftdeposit", authorization: auth("u"), data: { user: "u", dao: "d", asset_ids: ["1"] } });
    expect(dao.buildDepositNFTToTreasuryAction("u", "d", ["1"])).toEqual({ account: "atomicassets", name: "transfer", authorization: auth("u"), data: { from: "u", to: "dao.waxdao", asset_ids: ["1"], memo: "|treasury_deposit|d|" } });
  });
});

describe("pure helpers", () => {
  it("IPFS URLs", () => {
    expect(dao.getIpfsUrl("")).toBe("");
    expect(dao.getIpfsUrl("https://x/y.png")).toBe("https://x/y.png");
    expect(dao.getIpfsUrl("QmAbc")).toBe("https://resizer.atomichub.io/images/v1/preview?ipfs=QmAbc&size=370");
    expect(dao.getIpfsUrl("bafyAbc")).toBe("https://resizer.atomichub.io/images/v1/preview?ipfs=bafyAbc&size=370");
    expect(dao.getIpfsUrl("other")).toBe("other");
  });
  it("labels and expiry", () => {
    expect(dao.CREATABLE_DAO_TYPES).toEqual({ 4: "Stake Tokens (Custodial)", 5: "Hold NFTs (Non-Custodial)" });
    expect(dao.PROPOSER_TYPES).toEqual({ 0: "Authors Only", 1: "Anyone", 2: "Token Holders" });
    expect(dao.VOTING_TYPE_LABELS[3]).toBe("Ranked Choice");
    expect(dao.EXPIRY_THRESHOLD).toBe(2_592_000);
  });
});
