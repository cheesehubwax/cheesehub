import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/fetchWithFallback", () => ({ fetchWithFallback: (...a: unknown[]) => rpc(...a) }));
const hyperion = vi.fn();
vi.mock("@/lib/hyperionHistory", () => ({ fetchActionsUnion: (...a: unknown[]) => hyperion(...a) }));

vi.mock("@/lib/endpointHealth", () => ({ resolveEndpoints: async () => ["https://health-first.example"] }));

import { fetchProposals, fetchDaoTreasury, fetchUserStakedTokens, fetchAllDaos, checkDaoMembership } from "@/lib/dao";

const NOW = 1_800_000_000;
const json = (body: unknown) => ({ json: async () => body }) as Response;
const tableOf = (init: RequestInit) => JSON.parse(String(init.body)).table as string;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW * 1000); rpc.mockReset(); hyperion.mockReset(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const yna = (y: number, n: number, a: number) => [
  { choice: 0, description: "Yes", total_votes: y },
  { choice: 1, description: "No", total_votes: String(n) },
  { choice: 2, description: "Abstain", total_votes: a },
];

describe("fetchProposals parsing", () => {
  it("derives status and voting type exactly as before", async () => {
    hyperion.mockResolvedValue({ actions: [] });
    rpc.mockResolvedValue(json({ rows: [
      { proposal_id: 1, author: "a", title: "active", proposal_type: 4, outcome: 0, end_time: NOW + 10, choices: yna(0, 0, 0) },
      { proposal_id: 2, title: "passed", proposal_type: 4, outcome: 2, end_time: NOW - 10, choices: yna(5, 2, 0) },
      { proposal_id: 3, title: "rejected", proposal_type: 4, outcome: 2, end_time: NOW - 10, choices: yna(1, 2, 0) },
      { proposal_id: 4, title: "inconclusive", proposal_type: 4, outcome: 5, end_time: NOW - 10, choices: yna(0, 0, 3) },
      { proposal_id: 5, title: "executed", proposal_type: 4, outcome: 4, end_time: NOW - 10, choices: yna(5, 1, 0) },
      { proposal_id: 6, title: "pending", proposal_type: 4, outcome: 0, end_time: NOW - 10, choices: yna(0, 0, 0) },
      { proposal_id: 7, title: "expired", proposal_type: 4, outcome: 0, end_time: NOW - 2_592_001, choices: yna(0, 0, 0) },
      { proposal_id: 8, title: "multi passed", proposal_type: 0, outcome: 1, end_time: NOW - 10, choices: [{ choice: 0, description: "A", total_votes: 2 }] },
      { proposal_id: 9, title: "ranked none", proposal_type: 1, outcome: 1, end_time: NOW - 10, choices: [{ choice: 0, description: "A", total_votes: 0 }] },
      { proposal_id: 10, title: "outcome3", proposal_type: 2, outcome: 3, end_time: NOW - 10, choices: yna(0, 0, 0), token_receivers: [{ wax_account: "r", quantity: "1 X", contract: "x" }] },
      { proposal_id: 11, title: "nft6", proposal_type: 3, outcome: 6, end_time: NOW - 10, choices: yna(0, 0, 0), description: "[RANKED] hi" },
    ] }));
    const p = await fetchProposals("d");
    expect(p.map(x => x.status)).toEqual(["active", "passed", "rejected", "inconclusive", "executed", "pending", "expired", "passed", "rejected", "rejected", "expired"]);
    expect(p.map(x => x.voting_type)).toEqual([1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5]);
    expect(p[1]).toMatchObject({ yes_votes: 5, no_votes: 2, abstain_votes: 0, end_time: String(NOW - 10), end_time_ts: NOW - 10, proposer: "", dao_name: "d" });
    expect(p[0].proposer).toBe("a");
    expect(p[10].description).toBe("hi");
    expect(p[9].token_receivers).toEqual([{ wax_account: "r", quantity: "1 X", contract: "x" }]);
  });

  it("recovers token receivers from transfer actions, then Hyperion by title", async () => {
    rpc.mockResolvedValue(json({ rows: [
      { proposal_id: 1, title: "act", proposal_type: 4, outcome: 0, end_time: NOW + 1, choices: yna(0, 0, 0), actions: [{ contract: "eosio.token", action: "transfer", data: { to: "r1", quantity: "1.00000000 WAX" } }] },
      { proposal_id: 2, title: "hyp", proposal_type: 2, outcome: 0, end_time: NOW + 1, choices: yna(0, 0, 0) },
    ] }));
    hyperion.mockResolvedValue({ actions: [
      { act: { data: { dao: "d", proposal_type: 4, title: "hyp", token_receivers: [{ wax_account: "r2", quantity: "2 X" }] } } },
      { act: { data: { dao: "other", proposal_type: 4, title: "hyp", token_receivers: [{ wax_account: "no", quantity: "9 X" }] } } },
    ] });
    const p = await fetchProposals("d");
    expect(p[0].voting_type).toBe(4);
    expect(p[0].token_receivers).toEqual([{ wax_account: "r1", quantity: "1.00000000 WAX", contract: "eosio.token" }]);
    expect(p[1].token_receivers).toEqual([{ wax_account: "r2", quantity: "2 X", contract: "eosio.token" }]);
    expect(hyperion.mock.calls[0][0]).toBe("account=dao.waxdao&filter=dao.waxdao:newproposal");
  });

  it("returns [] on failure", async () => {
    rpc.mockRejectedValue(new Error("down"));
    expect(await fetchProposals("d")).toEqual([]);
  });
});

describe("other reads", () => {
  it("treasury balances infer contracts and skip zeros", async () => {
    rpc.mockResolvedValue(json({ rows: [
      { balance: "1.50000000 WAX" }, { balance: { quantity: "2.0000 CHEESE", contract: "cheeseburger" } },
      { balance: "0.0000 ZERO" }, { balance: "3 WAXDAO" }, { balance: "4.0 ABC" },
    ] }));
    expect(await fetchDaoTreasury("d")).toEqual([
      { contract: "eosio.token", symbol: "WAX", amount: 1.5, precision: 8 },
      { contract: "cheeseburger", symbol: "CHEESE", amount: 2, precision: 4 },
      { contract: "token.waxdao", symbol: "WAXDAO", amount: 3, precision: 0 },
      { contract: "unknown", symbol: "ABC", amount: 4, precision: 1 },
    ]);
  });
  it("staked token weight uses integer units", async () => {
    rpc.mockResolvedValue(json({ rows: [{ balance: "12.5000 CHEESE" }] }));
    expect(await fetchUserStakedTokens("d", "u")).toEqual({ balance: "12.5000 CHEESE", weight: 125000 });
  });

  it("counts 12.3456 CHEESE as 123456 units, not 123455", async () => {
    rpc.mockResolvedValue(json({ rows: [{ balance: "12.3456 CHEESE" }] }));
    expect((await fetchUserStakedTokens("d", "u"))?.weight).toBe(123456);
  });

  it("reads through the health-ordered node list", async () => {
    rpc.mockResolvedValue(json({ rows: [] }));
    await fetchUserStakedTokens("d", "u");
    expect(rpc.mock.calls[0][0]).toEqual(["https://health-first.example"]);
  });
  it("fetchAllDaos merges profiles from daoprofiles", async () => {
    rpc.mockImplementation(async (_e: unknown, _p: string, init: RequestInit) => tableOf(init) === "daos"
      ? json({ rows: [{ daoname: "d", creator: "c", dao_type: 4, threshold: "60.5", minimum_weight: "7", gov_token_symbol: "4,CHEESE" }] })
      : json({ rows: [{ dao_name: "d", profile: { description: "hi", avatar: "Qm1" }, socials: { twitter: "t" } }] }));
    const [d] = await fetchAllDaos();
    expect(d).toMatchObject({ dao_name: "d", creator: "c", description: "hi", logo: "Qm1", threshold: 60.5, minimum_weight: 7, proposal_cost: "0", socials: { twitter: "t" } });
  });
  it("membership needs positive stake or staked NFTs for that DAO", async () => {
    rpc.mockImplementation(async (_e: unknown, _p: string, init: RequestInit) => tableOf(init) === "stakedtokens"
      ? json({ rows: [{ dao: "d", balance: "0.0000 X" }, { dao: "e", balance: "1.0000 X" }] })
      : json({ rows: [{ daoname: "f" }] }));
    expect(await checkDaoMembership("d", "u")).toBe(false);
    expect(await checkDaoMembership("e", "u")).toBe(true);
    expect(await checkDaoMembership("f", "u")).toBe(true);
  });
});
