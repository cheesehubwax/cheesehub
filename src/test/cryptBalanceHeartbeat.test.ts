import { describe, it, expect } from "vitest";
import { isCryptPath } from "@/context/waxContextState";
describe("balance heartbeat silenced on CHEESECrypt", () => {
  it("matches crypt routes, with or without a base path", () => {
    expect(isCryptPath("/crypt")).toBe(true);
    expect(isCryptPath("/cheesehub/crypt/")).toBe(true);
  });
  it("keeps polling elsewhere", () => {
    expect(isCryptPath("/")).toBe(false);
    expect(isCryptPath("/cryptic")).toBe(false);
    expect(isCryptPath("/folio")).toBe(false);
  });
});
