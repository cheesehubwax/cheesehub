import { describe, it, expect } from "vitest";
import { isFarmFull } from "@/lib/farm";

const now = 1_800_000_000;
const farm = (funds: string, hourly: string, hoursLeft = 100, status = 1) => ({
  status,
  expiration: now + hoursLeft * 3600,
  reward_pools: [{ contract: "c", symbol: "X", balance: "0", precision: 2, total_funds: funds, total_hourly_reward: hourly }],
});

describe("isFarmFull", () => {
  it("is full when committed rewards use up remaining funds", () => {
    expect(isFarmFull(farm("100.00 X", "1.00 X"), now)).toBe(true);
    expect(isFarmFull(farm("540.10 X", "0.85 X", 6808), now)).toBe(true);
  });
  it("has room when funds exceed the commitment", () => {
    expect(isFarmFull(farm("100.01 X", "1.00 X"), now)).toBe(false);
  });
  it("ignores pools that pay nothing yet", () => {
    expect(isFarmFull(farm("0.00 X", "0.00 X"), now)).toBe(false);
  });
  it("never marks expired or closed farms full", () => {
    expect(isFarmFull(farm("1.00 X", "1.00 X", -1), now)).toBe(false);
    expect(isFarmFull(farm("1.00 X", "1.00 X", 100, 2), now)).toBe(false);
  });
});
