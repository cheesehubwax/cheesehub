import { describe, it, expect } from "vitest";
import { computeShadowQuote } from "@/lib/alcorRouter";

describe("shadow router", () => {
  it("computes a split quote WAX -> CHEESE for 100 WAX", async () => {
    const q = await computeShadowQuote({
      tokenIn: { contract: "eosio.token", ticker: "WAX", precision: 8 },
      tokenOut: { contract: "cheeseburger", ticker: "CHEESE", precision: 4 },
      amount: "100",
      tradeType: "EXACT_INPUT",
    });
    console.log(JSON.stringify(q, null, 2));
    expect(q).toBeTruthy();
    expect(q!.splits.length).toBeGreaterThan(0);
  }, 60_000);
});
