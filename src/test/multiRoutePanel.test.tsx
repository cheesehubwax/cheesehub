// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MultiRoutePanel } from "@/components/swap/MultiRoutePanel";
import type { SwapRoute, SwapRouteCandidate, SwapToken } from "@/lib/swapApi";
import "@testing-library/jest-dom";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom lacks ResizeObserver, which Radix Slider needs
window.ResizeObserver = window.ResizeObserver ?? ResizeObserverStub;

const tokenIn: SwapToken = { ticker: "CHEESE", contract: "cheeseburger", precision: 8 } as unknown as SwapToken;
const tokenOut: SwapToken = { ticker: "WAX", contract: "eosio.token", precision: 8 } as unknown as SwapToken;

const candidate: SwapRouteCandidate = {
  key: "alcor:1",
  venue: "alcor",
  route: [1],
  contract: "alcor.swap",
  visualPath: [
    { id: "cheese-cheeseburger", symbol: "CHEESE", contract: "cheeseburger", decimals: 8 },
    { id: "wax-eosio.token", symbol: "WAX", contract: "eosio.token", decimals: 8 },
  ],
  visualFees: [30],
  quotedInput: "",
  quotedOutput: "",
} as unknown as SwapRouteCandidate;

const route: SwapRoute = {
  swaps: [{
    route: [1],
    input: "",
    output: "",
    minReceived: "",
    routeKey: "alcor:1",
    visualPath: candidate.visualPath,
    visualFees: [30],
  }],
  availableRoutes: [],
} as unknown as SwapRoute;

function renderPanel() {
  const onAllocationsChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MultiRoutePanel
          route={route}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
          manualMode
          manualAllocations={[{ key: "alcor:1", bps: 10_000 }]}
          candidates={[candidate]}
          canUseManual
          onEnableManual={vi.fn()}
          onResetAuto={vi.fn()}
          onAllocationsChange={onAllocationsChange}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { onAllocationsChange };
}

describe("MultiRoutePanel add-route popup", () => {
  it("renders token logo pairs inside the add-a-pool-route options", async () => {
    renderPanel();
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });
    const option = screen.getAllByRole("option")[0];
    const images = option.querySelectorAll("img");
    // venue logo + overlapped token pair (CHEESE and WAX)
    expect(images.length).toBeGreaterThanOrEqual(3);
    const alts = Array.from(images).map((img) => img.getAttribute("alt") ?? "");
    expect(alts.some((a) => a.toUpperCase().includes("CHEESE"))).toBe(true);
    expect(alts.some((a) => a.toUpperCase().includes("WAX"))).toBe(true);
    expect(option.textContent).toContain("0.3%");
  });
});
