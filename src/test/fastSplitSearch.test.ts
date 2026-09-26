import { describe, it, expect } from "vitest";
import { Token, CurrencyAmount, computeAllRoutes, Trade, TradeType } from "@alcorexchange/alcor-swap-sdk";
import { buildPool, toRawAmount } from "@/lib/alcorQuoteCore";
import { fastBestTradeWithSplit } from "@/lib/fastSplitSearch";
import fixture from "./fixtures/alcorWaxCheesePools.json";

// Recorded live Alcor pools + ticks for WAX↔CHEESE (2026-09-26).
const pools = (fixture as any[])
  .filter((r) => r.ticks.length > 0)
  .map((r) => buildPool(r.p, r.ticks));
const WAX = new Token("eosio.token", 8, "WAX");
const CHEESE = new Token("cheeseburger", 4, "CHEESE");
const percents = Array.from({ length: 100 }, (_, i) => i + 1);
const cfg = { minSplits: 1, maxSplits: 6 };

const sig = (t: any) =>
  !t
    ? "null"
    : t.swaps
        .map((w: any) => `${w.percent}:${w.route.pools.map((p: any) => p.id).join(">")}=${w.inputAmount.toFixed()}/${w.outputAmount.toFixed()}`)
        .join("|");

describe("fastBestTradeWithSplit", () => {
  const cases: Array<[Token, Token, TradeType, string, number]> = [
    [WAX, CHEESE, TradeType.EXACT_INPUT, "100", 8],
    [WAX, CHEESE, TradeType.EXACT_INPUT, "5000", 8],
    [CHEESE, WAX, TradeType.EXACT_INPUT, "20", 4],
    [WAX, CHEESE, TradeType.EXACT_OUTPUT, "50", 4],
  ];
  for (const [a, b, tt, amt, dec] of cases) {
    it(`matches the SDK exactly: ${a.symbol}→${b.symbol} ${amt} ${tt}`, () => {
      const routes = computeAllRoutes(a, b, pools, 3);
      const amount = CurrencyAmount.fromRawAmount(tt === TradeType.EXACT_INPUT ? a : b, toRawAmount(amt, dec));
      const sdk = (Trade as any).bestTradeWithSplit(routes, amount, percents, tt, cfg);
      const fast = fastBestTradeWithSplit(routes, amount, percents, tt, cfg);
      expect(sig(fast)).toBe(sig(sdk));
    }, 60_000);
  }
});
