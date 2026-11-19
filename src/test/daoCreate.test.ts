import { describe, it, expect } from "vitest";
import { buildCreateDaoTransaction, checkAuthorCandidate, checkDaoName, checkGovSchemas, type CreateDaoTxInput } from "@/lib/daoCreate";

const base: CreateDaoTxInput = {
  accountName: "alice", paymentMethod: "wax", daoName: "mydao", daoType: 4, needsToken: true, needsSchemas: false,
  tokenContract: "cheeseburger", tokenSymbol: "4,CHEESE", govSchemas: [{ collection_name: "c", schema_name: "s" }],
  threshold: 60, hoursPerProposal: 48, minimumWeight: 0, minimumVotes: 1, proposerType: "0", authors: [" Bob ", "alice", ""],
  proposalCost: 0, description: "", avatar: "", coverImage: "", socials: {},
  cheese: { isAvailable: true, formattedForTx: "100.0000 CHEESE" }, waxdao: { isAvailable: true, formattedForTx: "1.00000000 WAXDAO" },
};
const names = (a: { account: string; name: string }[]) => a.map(x => `${x.account}::${x.name}`);

describe("Create DAO transaction", () => {
  it("WAX payment: fee, assertpoint, WAXDAO fee, then createdao", () => {
    const a = buildCreateDaoTransaction(base);
    expect(a).toHaveLength(4);
    expect(a.slice(1).map(x => x.name)).toEqual(["assertpoint", "transfer", "createdao"]);
    const create = a[3] as { data: Record<string, unknown> };
    expect(create.data).toMatchObject({ daoname: "mydao", proposer_type: 0, authors: ["alice", "bob"], proposal_cost: "0.00000000 WAX", threshold: 60, hours_per_proposal: 48, gov_schemas: [] });
  });
  it("CHEESE payment has same shape and only adds profile when given", () => {
    const a = buildCreateDaoTransaction({ ...base, paymentMethod: "cheese", description: "hi" });
    expect(a.map(x => x.name).slice(1)).toEqual(["assertpoint", "transfer", "createdao", "setprofile"]);
    expect(names(a)[4]).toBe("dao.waxdao::setprofile");
  });
  it("NFT DAO keeps only filled schemas and no token", () => {
    const a = buildCreateDaoTransaction({ ...base, daoType: 5, needsToken: false, needsSchemas: true, govSchemas: [{ collection_name: "c", schema_name: "s" }, { collection_name: "", schema_name: "" }] });
    expect((a[3] as { data: Record<string, unknown> }).data).toMatchObject({ gov_schemas: [{ collection_name: "c", schema_name: "s" }], gov_token_symbol: "0,NULL" });
  });
  it("unchanged today: unavailable pricing leaves only createdao", () => {
    expect(names(buildCreateDaoTransaction({ ...base, paymentMethod: "cheese", cheese: { isAvailable: false, formattedForTx: "" } }))).toEqual(["dao.waxdao::createdao"]);
  });
});

describe("Create DAO form rules", () => {
  it("DAO names", () => {
    expect(checkDaoName("cheesedao")).toBeNull();
    expect(checkDaoName("my.dao.123")).toBeNull();
    expect(checkDaoName("Bad")?.title).toBe("Invalid DAO name");
    expect(checkDaoName("abc6")).not.toBeNull();
    expect(checkDaoName("abcdefghijklm")).not.toBeNull();
  });
  it("governance schemas", () => {
    expect(checkGovSchemas([{ collection_name: "", schema_name: "" }], ["idle"], "a")?.title).toBe("Add at least 1 governance schema");
    expect(checkGovSchemas([{ collection_name: "c", schema_name: "s" }], ["not_authorized"], "a")?.description).toBe("You (a) must be an authorized account on every governance collection.");
    expect(checkGovSchemas([{ collection_name: "c", schema_name: "s" }], ["checking"], "a")?.title).toBe("Still verifying schemas");
    expect(checkGovSchemas([{ collection_name: "c", schema_name: "s" }], ["ok"], "a")).toBeNull();
  });
  it("author list", () => {
    expect(checkAuthorCandidate("  ", "a", [])).toEqual({ kind: "empty" });
    expect(checkAuthorCandidate(" Bob ", "a", [])).toEqual({ kind: "ok", account: "bob" });
    expect(checkAuthorCandidate("a", "a", []).kind).toBe("rejected");
    expect(checkAuthorCandidate("bob", "a", ["bob"]).kind).toBe("rejected");
    expect(checkAuthorCandidate("b0b", "a", []).kind).toBe("rejected");
  });
});
