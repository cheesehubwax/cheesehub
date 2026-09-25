import { describe, it, expect } from "vitest";
import { ammAmountOut, allocateAcrossAmm, ammMemo, rawToFixed, type AmmPoolState } from "@/lib/ammQuote";
import { normalizeRouteActions, type SwapRoute } from "@/lib/swapApi";
import { parseAsset } from "@/lib/ammSwapPools";

const WAX = { symbol: "WAX", contract: "eosio.token", decimals: 8 };
const CHEESE = { symbol: "CHEESE", contract: "cheeseburger", decimals: 4 };

function pool(venue: "defibox" | "taco", ra: string, rb: string, a = WAX, b = CHEESE): AmmPoolState {
  return {
    venue,
    id: venue === "taco" ? "CHEWAX" : "382",
    contract: venue === "taco" ? "swap.taco" : "swap.box",
    tokenA: a,
    tokenB: b,
    reserveA: ra,
    reserveB: rb,
  };
}

describe("Defibox quote maths (fitted to a real swaplog)", () => {
  it("matches on-chain output to within a few smallest units and never over-promises", () => {
    // swaplog pair 21: 24993.15165465 FATE in → 0.50111347 WAX out;
    // post-swap reserves 272.55013078 WAX / 13577716.18071433 FATE.
    const FATE = { symbol: "FATE", contract: "x", decimals: 8 };
    const inRaw = 2499315165465n;
    const waxPre = 27255013078n + 50111347n;
    const fatePre = 1357771618071433n - inRaw;
    const p = pool("defibox", waxPre.toString(), fatePre.toString(), WAX, FATE);
    const out = ammAmountOut(p, false, inRaw);
    expect(out <= 50111347n).toBe(true);
    expect(50111347n - out < 20n).toBe(true);
  });
});

describe("Taco quote maths (fitted to real exchangelogs)", () => {
  // quantity_in logged after the 0.2% protocol fee; transfers were in/0.998.
  const cases = [
    // [transfer in raw, pool in (post), pool out (post), actual out raw]
    { transferIn: 10000n, inPost: 157743n, outPost: 26368592n, logIn: 9980n, out: 1778803n },
  ];
  it("is at or just below the real output", () => {
    for (const c of cases) {
      const inPre = c.inPost - c.logIn;
      const outPre = c.outPost + c.out;
      const p = pool("taco", inPre.toString(), outPre.toString());
      const got = ammAmountOut(p, true, c.transferIn);
      expect(got <= c.out).toBe(true);
      expect(Number(c.out - got) / Number(c.out)).toBeLessThan(0.002);
    }
  });
});

describe("allocation and memos", () => {
  it("spreads across two pools and never loses output vs one pool", () => {
    const a = pool("defibox", "100000000000", "10000000");
    const b = pool("taco", "100000000000", "10000000");
    const total = 20000000000n;
    const one = ammAmountOut(a, true, total);
    const both = allocateAcrossAmm([{ pool: a, inIsA: true }, { pool: b, inIsA: true }], total);
    expect(both.out > one).toBe(true);
    expect(both.legs.reduce((s, l) => s + l.amountIn, 0n)).toBe(total);
  });

  it("builds the exact memo formats the venues accept", () => {
    expect(ammMemo(pool("defibox", "1", "1"), CHEESE, 123456n)).toBe("swap,123456,382");
    expect(ammMemo(pool("taco", "1", "1"), CHEESE, 123456n)).toBe("12.3456 CHEESE@cheeseburger");
    expect(rawToFixed(5n, 8)).toBe("0.00000005");
    expect(parseAsset("7.2224 CHEESE")).toEqual({ raw: "72224", decimals: 4, symbol: "CHEESE" });
  });

  it("sends each leg to its own exchange in one transaction", () => {
    const route = {
      output: 1, minReceived: 1, priceImpact: 0, memo: "m", route: [], executionPrice: { numerator: "1", denominator: "1" },
      swaps: [
        { percent: 30, route: [], input: "3.00000000", output: "1", minReceived: "1", memo: "swap,1,382", venue: "defibox", contract: "swap.box" },
        { percent: 70, route: [1], input: "7.00000000", output: "1", minReceived: "1", memo: "swapexactin#1#me#1.0000 CHEESE@cheeseburger#0", venue: "alcor", contract: "swap.alcor" },
      ],
    } as SwapRoute;
    const acts = normalizeRouteActions(route, "me", "eosio.token", "10", { contract: "eosio.token", ticker: "WAX", precision: 8 });
    expect(acts.map((a) => a.data.to)).toEqual(["swap.box", "swap.alcor"]);
    expect(acts.map((a) => a.data.quantity)).toEqual(["3.00000000 WAX", "7.00000000 WAX"]);
  });

  it("handles a single Defibox-only leg", () => {
    const route = {
      output: 1, minReceived: 1, priceImpact: 0, memo: "m", route: [], executionPrice: { numerator: "1", denominator: "1" },
      swaps: [{ percent: 100, route: [], input: "10.00000000", output: "1", minReceived: "1", memo: "swap,1,382", venue: "defibox", contract: "swap.box" }],
    } as SwapRoute;
    const acts = normalizeRouteActions(route, "me", "eosio.token", "10", { contract: "eosio.token", ticker: "WAX", precision: 8 });
    expect(acts).toHaveLength(1);
    expect(acts[0].data).toMatchObject({ to: "swap.box", memo: "swap,1,382", quantity: "10.00000000 WAX" });
  });
});
