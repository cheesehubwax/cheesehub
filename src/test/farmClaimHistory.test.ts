import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimedTotalsFromTransaction, fetchBaselineFromHyperion, loadSnapshot, saveSnapshot } from "@/lib/farmClaimHistory";

vi.mock("@/lib/endpointHealth", () => ({ resolveEndpoints: async () => ["https://history.example"] }));
vi.mock("@/lib/farm", () => ({ FARM_CONTRACT: "farms.waxdao" }));
vi.mock("@/lib/hyperionHistory", () => ({ fetchActionsUnion: vi.fn() }));
import { fetchActionsUnion } from "@/lib/hyperionHistory";

const account = "lgnam.c.wam";
const claim = (farm: string, ordinal: number) => ({ action_ordinal: ordinal, act: { account: "farms.waxdao", name: "claim", data: { user: account, farmname: farm } } });
const transfer = (farm: string, quantity: string, ordinal: number, parent: number) => ({
  action_ordinal: ordinal, creator_action_ordinal: parent,
  act: { account: "token", name: "transfer", data: { from: "farms.waxdao", to: account, quantity, memo: `claimed rewards from ${farm} farm on WaxDAO` } },
});
const traces: Parameters<typeof claimedTotalsFromTransaction>[1] = [transfer("trickycreate", "16.8000 TRICK", 6, 2), transfer("tsdminingv2", "15313.9272 TSDM", 3, 1), claim("trickycreate", 2), claim("tsdminingv2", 1)];
const expected = {
  trickycreate: [{ contract: "token", symbol: "TRICK", amount: 16.8 }],
  tsdminingv2: [{ contract: "token", symbol: "TSDM", amount: 15313.9272 }],
};

describe("farm-specific lifetime claims", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("keeps each farm's payouts separate in a real-shaped multi-farm transaction", () => {
    expect(claimedTotalsFromTransaction(account, traces)).toEqual(expected);
  });
  it("does not duplicate notification copies", () => {
    expect(claimedTotalsFromTransaction(account, [...traces, traces[0]])).toEqual(expected);
  });
  it("matches farm reward memos when a provider omits ancestry", () => {
    expect(claimedTotalsFromTransaction(account, traces.map(({ action_ordinal, creator_action_ordinal, ...trace }) => trace))).toEqual(expected);
  });
  it("does not attribute unrelated or conflicting transfers", () => {
    expect(claimedTotalsFromTransaction(account, [claim("trickycreate", 2), transfer("unknownfarm", "99.0000 TRICK", 6, 2)])).toEqual({});
    expect(claimedTotalsFromTransaction("otheruser", traces)).toEqual({});
  });
  it("keeps same-token payouts separated by farm", () => {
    expect(claimedTotalsFromTransaction(account, [claim("a", 1), claim("b", 2), transfer("a", "1.0000 CHEESE", 3, 1), transfer("b", "2.0000 CHEESE", 4, 2)])).toEqual({
      a: [{ contract: "token", symbol: "CHEESE", amount: 1 }], b: [{ contract: "token", symbol: "CHEESE", amount: 2 }],
    });
  });
  it("rejects previously misattributed cached totals and persists corrected totals", () => {
    localStorage.setItem(`cheesehub:farmClaims:v1:${account}`, JSON.stringify({ account, version: 1, totals: { wrong: expected.trickycreate } }));
    expect(loadSnapshot(account)).toBeNull();
    saveSnapshot({ account, version: 2, totals: expected, baselineFetchedAt: 1, lastClaimSeenAt: 1 });
    expect(loadSnapshot(account)?.totals).toEqual(expected);
  });
  it("reads a batched transaction once and rebuilds both farms' totals", async () => {
    vi.mocked(fetchActionsUnion).mockResolvedValue({ actions: [claim("trickycreate", 2), claim("tsdminingv2", 1)].map(t => ({ ...t, trx_id: "batch" })), endpointsSucceeded: 1, endpointsAttempted: 1, bestEndpointCount: 2 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ actions: traces })));
    expect((await fetchBaselineFromHyperion(account)).totals).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});