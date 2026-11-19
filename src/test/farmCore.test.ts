import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/waxRpcFallback", () => ({ fetchTableRows: vi.fn(), waxRpcCall: vi.fn() }));
import { fetchTableRows } from "@/lib/waxRpcFallback";
import * as F from "@/lib/farm";

const auth = (a: string) => [{ actor: a, permission: "active" }];

describe("farm maths", () => {
  it("effective balance subtracts accrued hourly rewards since last payout", () => {
    const r = F.calculateEffectiveBalance({ contract: "c", symbol: "CHEESE", precision: 4, balance: "100.0000 CHEESE", total_hourly_reward: "10.0000 CHEESE" }, 1000, 1000 + 7200);
    expect(r).toEqual({ effectiveBalance: 80, hourlyRate: 10, hoursRemaining: 8 });
  });
  it("effective balance never goes below zero", () => {
    const r = F.calculateEffectiveBalance({ contract: "c", symbol: "X", precision: 0, balance: "5 X", total_hourly_reward: "10 X" }, 1, 1 + 36000);
    expect(r.effectiveBalance).toBe(0);
    expect(r.hoursRemaining).toBe(0);
  });
  it("no rate or no payout yet returns raw balance with unknown runway", () => {
    expect(F.calculateEffectiveBalance({ contract: "c", symbol: "X", precision: 0, balance: "5 X" }, 1, 99)).toEqual({ effectiveBalance: 5, hourlyRate: 0, hoursRemaining: null });
    expect(F.calculateEffectiveBalance({ contract: "c", symbol: "X", precision: 0, balance: "5 X", total_hourly_reward: "1 X" }, 0, 99).hoursRemaining).toBeNull();
  });
  it("chunks values in 50s", () => {
    const v = Array.from({ length: 120 }, (_, i) => i);
    expect(F.chunkValues(v).map(c => c.length)).toEqual([50, 50, 20]);
    expect(F.chunkValues([1, 2])).toEqual([[1, 2]]);
    expect(F.chunkValues([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
  it("validates farm names", () => {
    expect(F.validateFarmName("")).toEqual({ valid: false, error: "Farm name is required" });
    expect(F.validateFarmName("abcdefghijklm").valid).toBe(false);
    expect(F.validateFarmName("Abc").valid).toBe(false);
    expect(F.validateFarmName("ab6").valid).toBe(false);
    expect(F.validateFarmName("cheese.farm1")).toEqual({ valid: true });
  });
  it("collection names are unique across config parts", () => {
    expect(F.getCollectionNames({ collections: [{ collection: "a", hourly_rate: "1" }], schemas: [{ collection: "a", schema: "s", hourly_rate: "1" }], templates: [{ template_id: 1, collection: "b", hourly_rate: "1" }], attributes: [] })).toEqual(["a", "b"]);
  });
});

describe("farm transaction builders", () => {
  it("creation fees and assertpoint", () => {
    expect(F.buildAssertPointAction("u")).toEqual({ account: "farms.waxdao", name: "assertpoint", authorization: auth("u"), data: { user: "u" } });
    expect(F.buildFarmCreationFeeWaxAction("u").data).toEqual({ from: "u", to: "farms.waxdao", quantity: "265.00000000 WAX", memo: "|create_farm|" });
    expect(F.buildFarmCreationFeeWaxAction("u").account).toBe("eosio.token");
    expect(F.buildFarmCreationFeeWaxdaoAction("u")).toMatchObject({ account: "mdcryptonfts", data: { quantity: "25000.00000000 WAXDAO", memo: "|create_farm|" } });
    expect(F.buildFarmCreationFeeWojakAction("u", "9")).toMatchObject({ account: "atomicassets", name: "transfer", data: { asset_ids: ["9"], memo: "|create_farm|" } });
  });
  it("createfarm maps type and reward symbols", () => {
    const a = F.buildCreateFarmAction("u", "f", "attributes", 24, [{ contract: "cheeseburger", symbol: "CHEESE", precision: 4 }], { avatar: "", cover_image: "", description: "" }, { website: "", telegram: "", discord: "", twitter: "", medium: "", youtube: "", atomichub: "", waxdao: "" });
    expect(a.name).toBe("createfarm");
    expect(a.data.farm_type).toBe(3);
    expect(a.data.hours_between_payouts).toBe(24);
    expect(a.data.reward_tokens).toEqual([{ contract: "cheeseburger", token_symbol: "4,CHEESE" }]);
  });
  it("set-value builders accept one or many", () => {
    const rw = [{ quantity: "1.0000 CHEESE", contract: "cheeseburger" }];
    expect(F.buildSetTemplateValuesAction("u", "f", "col", [1, 2], rw).data.values).toEqual([
      { template_id: 1, collection_name: "col", hourly_rewards: rw },
      { template_id: 2, collection_name: "col", hourly_rewards: rw },
    ]);
    expect(F.buildSetSchemaValuesAction("u", "f", "col", "s", rw)).toMatchObject({ name: "setschvalues", data: { values: [{ collection_name: "col", schema_name: "s", hourly_rewards: rw }] } });
    expect(F.buildSetCollectionValuesAction("u", "f", ["a"], rw)).toMatchObject({ name: "setcolvalues", data: { values: [{ collection_name: "a", hourly_rewards: rw }] } });
    expect(F.buildSetAttributeValuesAction("u", "f", "rarity", ["x"], rw)).toMatchObject({ name: "setattvalues", data: { values: [{ attribute_name: "rarity", attribute_value: "x", hourly_rewards: rw }] } });
  });
  it("erase, lifecycle, staking and claim actions", () => {
    const cases: [{ account: string; name: string; authorization: unknown; data: unknown }, string, Record<string, unknown>][] = [
      [F.buildEraseTemplateValuesAction("u", "f", 7), "removetemp", { user: "u", farmname: "f", template_id: 7 }],
      [F.buildEraseSchemaValuesAction("u", "f", "c", "s"), "removeschema", { user: "u", farmname: "f", collection_name: "c", schema_name: "s" }],
      [F.buildEraseCollectionValuesAction("u", "f", "c"), "removecol", { user: "u", farmname: "f", collection_name: "c" }],
      [F.buildEraseAttributeValuesAction("u", "f", "k", "v"), "eraseattvalue", { user: "u", farmname: "f", attribute_name: "k", attribute_value: "v" }],
      [F.buildCloseFarmAction("u", "f"), "closefarm", { user: "u", farmname: "f" }],
      [F.buildPermCloseFarmAction("u", "f"), "permclosefrm", { user: "u", farmname: "f" }],
      [F.buildKickManyAction("u", "f", 5), "kickmany", { user: "u", farmname: "f", quantity_of_users: 5 }],
      [F.buildEmptyFarmAction("u", "f"), "emptyfarm", { user: "u", farmname: "f" }],
      [F.buildOpenFarmAction("u", "f", 99), "openfarm", { user: "u", farmname: "f", expiration: 99 }],
      [F.buildExtendFarmAction("u", "f", 99), "extendfarm", { user: "u", farmname: "f", expiration: 99 }],
      [F.buildWithdrawRewardsAction("u", "f", "tk", "1 X"), "withdraw", { user: "u", farm_name: "f", amount: { quantity: "1 X", contract: "tk" } }],
      [F.buildStakeNftsAction("u", "f", ["1"]), "stakenfts", { user: "u", farmname: "f", assets_to_stake: ["1"] }],
      [F.buildUnstakeNftsAction("u", "f", ["1"]), "unstake", { user: "u", farmname: "f", asset_ids: ["1"] }],
      [F.buildClaimRewardsAction("u", "f"), "claim", { user: "u", farmname: "f" }],
    ];
    for (const [a, name, data] of cases) expect(a).toEqual({ account: "farms.waxdao", name, authorization: auth("u"), data });
  });
  it("deposit transfers to the farm with the deposit memo", () => {
    expect(F.buildAddRewardsAction("u", "f", "cheeseburger", "5.0000 CHEESE")).toEqual({ account: "cheeseburger", name: "transfer", authorization: auth("u"), data: { from: "u", to: "farms.waxdao", quantity: "5.0000 CHEESE", memo: "|farm_deposit|f|" } });
  });
  it("profile fills every social with empty strings", () => {
    const a = F.buildSetFarmProfileAction("u", "f", { avatar: "a", cover_image: "", description: "d" }, { twitter: "t" });
    expect(a.data.socials).toEqual({ atomichub: "", discord: "", medium: "", telegram: "", twitter: "t", waxdao: "", website: "", youtube: "" });
  });
});

describe("pending rewards", () => {
  beforeEach(() => vi.mocked(fetchTableRows).mockReset());
  it("reads the user row from the farmname index (4)", async () => {
    vi.mocked(fetchTableRows).mockResolvedValueOnce({ rows: [{ user: "x" }, { user: "u", claimable_balances: [{ quantity: "12.3400 CHEESE", contract: "cheeseburger" }, { quantity: "3 NUM", contract: "n" }] }], more: false } as never);
    expect(await F.fetchPendingRewards("u", "f")).toEqual([{ symbol: "CHEESE", amount: 12.34, precision: 4 }, { symbol: "NUM", amount: 3, precision: 0 }]);
    expect(vi.mocked(fetchTableRows).mock.calls[0][0]).toMatchObject({ index_position: 4, lower_bound: "f" });
  });
  it("falls back to the user index (3)", async () => {
    vi.mocked(fetchTableRows).mockResolvedValueOnce({ rows: [], more: false } as never).mockResolvedValueOnce({ rows: [{ farmname: "f", claimable_balances: [{ quantity: "1.0 W", contract: "c" }] }], more: false } as never);
    expect(await F.fetchPendingRewards("u", "f")).toEqual([{ symbol: "W", amount: 1, precision: 1 }]);
    expect(vi.mocked(fetchTableRows).mock.calls[1][0]).toMatchObject({ index_position: 3, lower_bound: "u" });
  });
});
