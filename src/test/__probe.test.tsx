// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import * as ReactDOMClient from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import MultiRoutePanel from "@/components/swap/MultiRoutePanel";
import type { SwapRoute, SwapToken, SwapRouteCandidate } from "@/lib/swapApi";

describe("probe5", () => {
  it("finds undefined element", () => {
    const orig = React.createElement;
    (React as any).createElement = (...args: any[]) => {
      if (args[0] === undefined) {
        const err = new Error();
        console.log("UNDEF STACK:\n" + (err.stack ?? "").split("\n").slice(1, 10).join("\n"));
      }
      return orig(...(args as [any]));
    };
    const tokenIn = { ticker: "CHEESE", contract: "cheeseburger", precision: 8 } as unknown as SwapToken;
    const tokenOut = { ticker: "WAX", contract: "eosio.token", precision: 8 } as unknown as SwapToken;
    const cand = {
      key: "alcor:1", venue: "alcor", route: [1], contract: "alcor.swap",
      visualPath: [{ id: "a", symbol: "CHEESE", contract: "c", decimals: 8 }, { id: "b", symbol: "WAX", contract: "e", decimals: 8 }],
      visualFees: [30], quotedInput: "", quotedOutput: "",
    } as unknown as SwapRouteCandidate;
    const route = { swaps: [{ route: [1], input: "", output: "", minReceived: "", routeKey: "alcor:1", visualPath: cand.visualPath, visualFees: [30] }], availableRoutes: [] } as unknown as SwapRoute;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const div = document.createElement("div");
    const origErr = console.error; console.error = () => {};
    try {
      ReactDOMClient.createRoot(div).render(<QueryClientProvider client={qc}><TooltipProvider><MultiRoutePanel route={route} tokenIn={tokenIn} tokenOut={tokenOut} manualMode manualAllocations={[{ key: "alcor:1", bps: 10000 }]} candidates={[cand]} canUseManual onEnableManual={() => {}} onResetAuto={() => {}} onAllocationsChange={() => {}} /></TooltipProvider></QueryClientProvider>);
    } catch (e) { console.log("CAUGHT:", (e as Error).message.slice(0, 60)); }
    console.error = origErr;
    (React as any).createElement = orig;
    expect(true).toBe(true);
  });
});
