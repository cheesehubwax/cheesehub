import { describe, it, expect } from "vitest";
import { nftImageCandidates } from "@/components/dao/TreasuryNftImage";
import { ipfsImageCandidates } from "@/lib/ipfsGateways";

describe("treasury NFT image candidates", () => {
  it("uses the shared AtomicHub-then-gateway list for bare hashes", () => {
    expect(nftImageCandidates("QmYTvGVY8eVxrzYf7VTgqJJqZiNJF7gAfji6ewxo4qUyeA")).toEqual(ipfsImageCandidates("QmYTvGVY8eVxrzYf7VTgqJJqZiNJF7gAfji6ewxo4qUyeA"));
    expect(nftImageCandidates("QmYTvGVY8eVxrzYf7VTgqJJqZiNJF7gAfji6ewxo4qUyeA").length).toBeGreaterThan(1);
  });
  it("is empty without an image", () => {
    expect(nftImageCandidates("")).toEqual([]);
  });
});
