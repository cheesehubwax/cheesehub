import { describe, it, expect } from "vitest";
import { planClaimBatches, readyRewards, sumRewards, formatUnits, type ReadyFarm } from "@/lib/farmClaimAll";

const t = (units: bigint) => ({ symbol: "CHEESE", contract: "cheeseburger", precision: 4, units });

describe("claim all", () => {
  it("excludes farms with nothing to claim", () => {
    const farms: ReadyFarm[] = [{ farmName: "a", rewards: [t(0n)] }, { farmName: "b", rewards: [] }, { farmName: "c", rewards: [t(5n)] }];
    expect(planClaimBatches(farms).flat().map(f => f.farmName)).toEqual(["c"]);
  });
  it("splits 12 ready farms into batches of 5, 5, 2", () => {
    const farms = Array.from({ length: 12 }, (_, i) => ({ farmName: `f${i}`, rewards: [t(1n)] }));
    expect(planClaimBatches(farms, 5).map(b => b.length)).toEqual([5, 5, 2]);
  });
  it("sums per token exactly without float rounding", () => {
    const total = sumRewards([{ farmName: "a", rewards: [t(1n)] }, { farmName: "b", rewards: [t(2n)] }]);
    expect(formatUnits(total[0])).toBe("0.0003");
  });
  it("adds only completed payout periods", () => {
    const row = { farmName: "x", claimable: [{ quantity: "1.0000 CHEESE", contract: "cheeseburger" }], rates: [{ quantity: "2.0000 CHEESE", contract: "cheeseburger" }], lastStateChange: 1000 };
    const r = readyRewards(row, { payoutInterval: 3600, expiration: 0, isActive: true }, 1000 + 3600 * 3 + 500);
    expect(formatUnits(r[0])).toBe("7.0000");
  });
});

import { splitReadyFarms } from "@/lib/farmClaimAll";
describe("claim all hover summary", () => {
  it("counts only farms with rewards ready; unknown farms are empty", () => {
    const row = (farmName: string, claimable: string) => ({ farmName, claimable: [{ quantity: claimable, contract: "cheeseburger" }], rates: [], lastStateChange: 0 });
    const timing = new Map([["a", { payoutInterval: 3600, expiration: 0, isActive: true }], ["b", { payoutInterval: 3600, expiration: 0, isActive: true }]]);
    const { ready, empty } = splitReadyFarms([row("a", "1.0000 CHEESE"), row("b", "0.0000 CHEESE"), row("x", "5.0000 CHEESE")], timing, 10_000);
    expect(ready.map(r => r.farmName)).toEqual(["a"]);
    expect(empty).toEqual(["b", "x"]);
  });
});
