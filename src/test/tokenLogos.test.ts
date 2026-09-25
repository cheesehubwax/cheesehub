import { describe, expect, it } from "vitest";
import { getTokenLogoUrl, isLocalLogoUrl } from "@/lib/tokenLogos";
import { getTokenLogoUrl as getSwapTokenLogoUrl } from "@/lib/swapApi";

describe("token logo resolution", () => {
  it("uses bundled assets for WAX and CHEESE", () => {
    const wax = getTokenLogoUrl("eosio.token", "WAX");
    const cheese = getTokenLogoUrl("cheeseburger", "CHEESE");

    expect(isLocalLogoUrl(wax)).toBe(true);
    expect(isLocalLogoUrl(cheese)).toBe(true);
    expect(wax).toContain("wax-token");
    expect(cheese).toContain("cheese-token-logo");
  });

  it("uses the shared resolver in CHEESESwap", () => {
    expect(getSwapTokenLogoUrl("eosio.token", "WAX")).toBe(
      getTokenLogoUrl("eosio.token", "WAX"),
    );
  });

  it("keeps remote lookup for tokens without a bundled logo", () => {
    expect(getTokenLogoUrl("token.example", "OTHER")).toBe(
      "https://wax.alcor.exchange/api/v2/tokens/other-token.example/logo",
    );
  });
});