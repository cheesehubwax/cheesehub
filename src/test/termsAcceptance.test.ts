import { describe, it, expect } from "vitest";
import { acceptTerms, hasAcceptedTerms, TERMS_STORAGE_KEY, TERMS_VERSION } from "@/lib/termsAcceptance";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("sign-in Terms acceptance", () => {
  it("asks again until accepted, then skips", () => {
    const s = mem();
    expect(hasAcceptedTerms(s)).toBe(false);
    acceptTerms(s);
    expect(hasAcceptedTerms(s)).toBe(true);
  });
  it("re-prompts when an older Terms version was accepted", () => {
    const s = mem();
    s.setItem(TERMS_STORAGE_KEY, "2020-01");
    expect(hasAcceptedTerms(s)).toBe(false);
    expect(TERMS_VERSION).not.toBe("2020-01");
  });
});
