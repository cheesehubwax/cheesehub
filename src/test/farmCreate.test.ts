import { describe, it, expect } from "vitest";
import { buildCreateFarmTransaction, validateCreateFarmForm, type CreateFarmForm } from "@/lib/farmCreate";

const form: CreateFarmForm = { farmName: "cheesefarm1", avatar: " Qm1 ", coverImage: "", description: " hi ", hoursBetweenPayouts: "24", farmType: "templates", twitter: "t", discord: "", telegram: "", website: "", youtube: "", medium: "" };
const tokens = [{ contract: "cheeseburger", symbol: "CHEESE", precision: 4 }];
const pricing = { cheeseAvailable: true, cheeseForTx: "100.0000 CHEESE", waxdaoAvailable: true, waxdaoForTx: "5.00000000 WAXDAO" };
type A = { account: string; name: string; data: Record<string, unknown> };

describe("farm creation transaction", () => {
  it("CHEESE payment: fee, assertpoint, WAXDAO fee, createfarm in that order", () => {
    const a = buildCreateFarmTransaction("u", form, tokens, "cheese", pricing) as A[];
    expect(a.map(x => `${x.account}::${x.name}`)).toEqual(["cheeseburger::transfer", "farms.waxdao::assertpoint", "token.waxdao::transfer", "farms.waxdao::createfarm"]);
    expect(a[0].data.quantity).toBe("100.0000 CHEESE");
    expect(a[2].data).toMatchObject({ to: "farms.waxdao", quantity: "5.00000000 WAXDAO", memo: "|create_farm|" });
    expect(a[3].data).toMatchObject({ farmname: "cheesefarm1", farm_type: 2, hours_between_payouts: 24, profile: { avatar: "Qm1", cover_image: "", description: "hi" } });
  });
  it("WAX payment uses the WAX leg", () => {
    const a = buildCreateFarmTransaction("u", form, tokens, "wax", pricing) as A[];
    expect(a[0]).toMatchObject({ account: "eosio.token", name: "transfer" });
    expect(a).toHaveLength(4);
  });
  it("validates hours 1–720, complete reward tokens and a payment method", () => {
    expect(validateCreateFarmForm({ ...form, hoursBetweenPayouts: "0" }, tokens, "wax")).toBe("Hours between payouts must be between 1 and 720");
    expect(validateCreateFarmForm({ ...form, hoursBetweenPayouts: "721" }, tokens, "wax")).not.toBeNull();
    expect(validateCreateFarmForm({ ...form, hoursBetweenPayouts: "720" }, tokens, "wax")).toBeNull();
    expect(validateCreateFarmForm(form, [{ contract: " ", symbol: "X", precision: 0 }], "wax")).toBe("All reward tokens must have a contract and symbol");
    expect(validateCreateFarmForm(form, tokens, null)).toBe("Please select a payment method");
  });
});
