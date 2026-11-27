import { describe, it, expect } from "vitest";
import { parseTeaserTag, applyTeaserTag, proposalsLocked, TEASER_TAG } from "@/lib/daoTeaser";

describe("dao teaser setting", () => {
  it("is off by default and leaves text untouched", () => {
    expect(parseTeaserTag("Hello DAO")).toEqual({ description: "Hello DAO", teaser: false });
  });
  it("round-trips on and strips the tag from the visible text", () => {
    const raw = applyTeaserTag("Hello DAO", true);
    expect(raw).toContain(TEASER_TAG);
    expect(parseTeaserTag(raw)).toEqual({ description: "Hello DAO", teaser: true });
  });
  it("turning off removes the tag", () => {
    expect(applyTeaserTag(applyTeaserTag("x", true), false)).toBe("x");
  });
  it("locks only non-members of opted-in DAOs", () => {
    expect(proposalsLocked(true, false)).toBe(true);
    expect(proposalsLocked(true, true)).toBe(false);
    expect(proposalsLocked(false, false)).toBe(false);
  });
});
