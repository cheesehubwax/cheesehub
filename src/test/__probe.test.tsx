// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MultiRoutePanel from "@/components/swap/MultiRoutePanel";
import type { SwapRoute, SwapToken, SwapRouteCandidate } from "@/lib/swapApi";

describe("probe", () => {
  it("renders panel", () => {
    const tokenIn = { ticker: "CHEESE", contract: "cheeseburger", precision: 8 } as unknown as SwapToken;
    const tokenOut = { ticker: "WAX", contract: "eosio.token", precision: 8 } as unknown as SwapToken;
    const cand = {
      key: "alcor:1", venue: "alcor", route: [1], contract: "alcor.swap",
      visualPath: [{ id: "a", symbol: "CHEESE", contract: "c", decimals: 8 }, { id: "b", symbol: "WAX", contract: "e", decimals: 8 }],
      visualFees: [30], quotedInput: "", quotedOutput: "",
    } as unknown as SwapRouteCandidate;
    const route = { swaps: [{ route: [1], input: "", output: "", minReceived: "", routeKey: "alcor:1", visualPath: cand.visualPath, visualFees: [30] }], availableRoutes: [] } as unknown as SwapRoute;
    const orig = console.error; console.error = () => {};
    try {
      render(<MultiRoutePanel route={route} tokenIn={tokenIn} tokenOut={tokenOut} manualMode manualAllocations={[{ key: "alcor:1", bps: 10000 }]} candidates={[cand]} canUseManual onEnableManual={() => {}} onResetAuto={() => {}} onAllocationsChange={() => {}} />);
      console.log("PANEL RENDER OK");
    } catch (e) { console.log("PANEL FAIL:", (e as Error).message); }
    console.error = orig;
    expect(true).toBe(true);
  });
});
