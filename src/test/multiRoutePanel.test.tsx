// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MultiRoutePanel from "@/components/swap/MultiRoutePanel";
import type { SwapRouteCandidate, SwapRoute, SwapToken } from "@/lib/swapApi";
import "@testing-library/jest-dom";

const tokenIn: SwapToken = { ticker: "CHEESE", contract: "cheeseburger", precision: 8 } as SwapToken;
const tokenOut: SwapToken = { ticker: "WAX", contract: "eosio.token", precision: 8 } as SwapToken;

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

function renderPanel(manual = true) {
  const onAllocationsChange = vi.fn();
  const utils = render(
    <MultiRoutePanel
      route={route}
      tokenIn={tokenIn}
      tokenOut={tokenOut}
      manualMode={manual}
      manualAllocations={manual ? [{ key: "alcor:1", bps: 10_000 }] : []}
      candidates={manual ? [candidate] : []}
      canUseManual
      onEnableManual={vi.fn()}
      onResetAuto={vi.fn()}
      onAllocationsChange={onAllocationsChange}
    />,
  );
  return { ...utils, onAllocationsChange };
}

describe("MultiRoutePanel add-route popup", () => {
  it("renders token logo pairs inside the add-a-pool-route options", async () => {
    renderPanel();
    const trigger = screen.getByRole("combobox");
    fireEvent.pointerDown(trigger);
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);
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
  });
});
