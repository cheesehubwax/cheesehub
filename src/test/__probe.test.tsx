// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import * as jsx from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import MultiRoutePanel from "@/components/swap/MultiRoutePanel";
import type { SwapRoute, SwapToken, SwapRouteCandidate } from "@/lib/swapApi";

describe("probe6", () => {
  it("finds undefined element via jsx hook", () => {
    const mod = jsx as any;
    for (const fn of ["jsx", "jsxs", "jsxDEV"]) {
      if (typeof mod[fn] !== "function") continue;
      const orig = mod[fn].bind(mod);
      mod[fn] = (type: any, ...rest: any[]) => {
        if (type === undefined) {
          const err = new Error();
          console.log("UNDEF STACK:\n" + (err.stack ?? "").split("\n").slice(1, 8).join("\n"));
        }
        return orig(type, ...rest);
      };
    }
    const tokenIn = { ticker: "CHEESE", contract: "cheeseburger", precision: 8 } as unknown as SwapToken;
    const tokenOut = { ticker: "WAX", contract: "eosio.token", precision: 8 } as unknown as SwapToken;
    const cand = {
      key: "alcor:1", venue: "alcor", route: [1], contract: "alcor.swap",
      visualPath: [{ id: "a", symbol: "CHEESE", contract: "c", decimals: 8 }, { id: "b", symbol: "WAX", contract: "e", decimals: 8 }],
      visualFees: [30], quotedInput: "", quotedOutput: "",
    } as unknown as SwapRouteCandidate;
    const route = { swaps: [{ route: [1], input: "", output: "", minReceived: "", routeKey: "alcor:1", visualPath: cand.visualPath, visualFees: [30] }], availableRoutes: [] } as unknown as SwapRoute;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { render } = await import("@testing-library/react");
    const origErr = console.error; console.error = () => {};
    try {
      render(<QueryClientProvider client={qc}><TooltipProvider><MultiRoutePanel route={route} tokenIn={tokenIn} tokenOut={tokenOut} manualMode manualAllocations={[{ key: "alcor:1", bps: 10000 }]} candidates={[cand]} canUseManual onEnableManual={() => {}} onResetAuto={() => {}} onAllocationsChange={() => {}} /></TooltipProvider></QueryClientProvider>);
    } catch (e) { console.log("CAUGHT:", (e as Error).message.slice(0, 60)); }
    console.error = origErr;
    expect(true).toBe(true);
  });
});
