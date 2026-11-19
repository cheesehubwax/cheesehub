import { describe, it, expect } from "vitest";
import { daoSocialEntries } from "@/lib/daoSocials";

describe("DAO social links", () => {
  it("keeps display order and skips empty values", () => {
    expect(daoSocialEntries(undefined)).toEqual([]);
    expect(daoSocialEntries({ medium: "m", twitter: "t", waxdao: "w", website: "", atomichub: "a" }).map(e => e.label))
      .toEqual(["Twitter", "AtomicHub", "WaxDAO", "Medium"]);
  });
});
