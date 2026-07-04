import { describe, it, expect } from "vitest";
import { computeShadowQuote } from "@/lib/alcorRouter";

// Live-network smoke test — skipped in CI. Run manually:
//   RUN_SHADOW=1 bunx vitest run src/test/shadow.test.ts
const maybe = process.env.RUN_SHADOW ? describe : describe.skip;

maybe("shadow router (live)", () => {
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

  it("finds multi-split routing for 1000 WAX -> CHEESE (parity vs. Alcor)", async () => {
    const q = await computeShadowQuote({
      tokenIn: { contract: "eosio.token", ticker: "WAX", precision: 8 },
      tokenOut: { contract: "cheeseburger", ticker: "CHEESE", precision: 4 },
      amount: "1000",
      tradeType: "EXACT_INPUT",
    });
    console.log(JSON.stringify(q, null, 2));
    expect(q).toBeTruthy();
    // With the hub allowlist removed the router should find at least two
    // distinct paths for a large WAX→CHEESE trade.
    expect(q!.splits.length).toBeGreaterThanOrEqual(2);
    // Alcor's public quote for the same trade was ~555 CHEESE at record time.
    // Guard against a >0.5% regression from a locally recorded baseline.
    expect(parseFloat(q!.totalOutput)).toBeGreaterThan(552);
  }, 90_000);
});
