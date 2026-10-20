import { describe, it, expect } from "vitest";
import { exactOutputMaxInput, normalizeRouteActions, type SwapRoute } from "@/lib/swapApi";

const tokenIn = { contract: "eosio.token", ticker: "WAX", precision: 8 } as any;
const base = { output: 100000, minReceived: 100000, priceImpact: 0, route: [1], executionPrice: { numerator: "1", denominator: "1" } };

describe("EXACT_OUTPUT swap funding", () => {
  it("sends the summed slippage max of each split, not the ideal input", () => {
    const route = { ...base, memo: "m", input: 10, swaps: [
      { percent: 50, route: [1], input: "5.00000000", output: "1", minReceived: "1", maxSent: "5.02500000", memo: "a" },
      { percent: 50, route: [2], input: "5.00000000", output: "1", minReceived: "1", maxSent: "5.025000001", memo: "b" },
    ] } as SwapRoute;
    const max = exactOutputMaxInput(route, 0.5, 8);
    expect(max).toBe("10.05000001");
    const actions = normalizeRouteActions(route, "alice", "eosio.token", max, tokenIn, true);
    expect(actions.map((a) => a.data.quantity)).toEqual(["5.02500000 WAX", "5.02500001 WAX"]);
  });

  it("falls back to ideal input plus slippage, rounded up", () => {
    const route = { ...base, memo: "m", input: 10, swaps: [{ percent: 100, route: [1], input: "10", output: "1", minReceived: "1" }] } as SwapRoute;
    expect(exactOutputMaxInput(route, 1, 8)).toBe("10.10000000");
    const actions = normalizeRouteActions(route, "alice", "eosio.token", "10.10000000", tokenIn, true);
    expect(actions[0].data.quantity).toBe("10.10000000 WAX");
  });
});
