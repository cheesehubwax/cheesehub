// CHEESEDao "Create DAO" form rules and transaction assembly (pure; nothing is sent here).
import { buildAssertPointAction, buildCreateDaoAction, buildSetProfileActionWithSocials, type DaoSocials } from "@/lib/dao";
import { buildCheesePaymentAction, buildWaxPaymentAction, buildWaxdaoFeeAction } from "@/lib/cheeseFees";

export const WAX_NAME_RE = /^[a-z1-5.]{1,12}$/;

export interface FormMessage { title: string; description: string; }

export type GovSchema = { collection_name: string; schema_name: string };
/** Mirrors GovSchemaRow's on-chain check states. */
export type SchemaStatus = string;

export function checkDaoName(daoName: string): FormMessage | null {
  if (!daoName.trim() || !WAX_NAME_RE.test(daoName)) {
    return { title: "Invalid DAO name", description: "Must be 1-12 chars, a-z, 1-5, and ." };
  }
  return null;
}

/** Validates NFT governance schemas in the same order and wording as before. */
export function checkGovSchemas(govSchemas: GovSchema[], schemaStatuses: SchemaStatus[], accountName: string): FormMessage | null {
  const filled = govSchemas
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.collection_name && s.schema_name);
  if (filled.length === 0) {
    return { title: "Add at least 1 governance schema", description: "NFT-based DAOs require at least one collection + schema." };
  }
  const bad = filled.find(({ i }) => schemaStatuses[i] && schemaStatuses[i] !== "ok" && schemaStatuses[i] !== "checking");
  if (bad) {
    const reasons: Record<string, string> = {
      no_collection: "Collection does not exist on AtomicAssets.",
      no_schema: "Schema does not exist in that collection.",
      not_authorized: `You (${accountName}) must be an authorized account on every governance collection.`,
    };
    return {
      title: "Invalid governance schema",
      description: reasons[schemaStatuses[bad.i]] ?? "One or more governance schemas are invalid.",
    };
  }
  if (filled.some(({ i }) => schemaStatuses[i] === "checking")) {
    return { title: "Still verifying schemas", description: "Please wait for on-chain verification to finish." };
  }
  return null;
}

export type AuthorCandidate =
  | { kind: "empty" }
  | { kind: "ok"; account: string }
  | { kind: "rejected"; toast: FormMessage & { variant?: "destructive" } };

export function checkAuthorCandidate(input: string, accountName: string | null | undefined, authors: string[]): AuthorCandidate {
  const v = input.trim().toLowerCase();
  if (!v) return { kind: "empty" };
  if (!WAX_NAME_RE.test(v)) {
    return { kind: "rejected", toast: { title: "Invalid WAX account", description: "Use a-z, 1-5, dot. Max 12 chars.", variant: "destructive" } };
  }
  if (v === accountName) {
    return { kind: "rejected", toast: { title: "Already included", description: "The creator is added automatically." } };
  }
  if (authors.includes(v)) {
    return { kind: "rejected", toast: { title: "Duplicate", description: `${v} is already in the list.` } };
  }
  return { kind: "ok", account: v };
}

interface Pricing { isAvailable: boolean; formattedForTx: string; }

export interface CreateDaoTxInput {
  accountName: string;
  paymentMethod: "wax" | "cheese";
  daoName: string;
  daoType: number;
  needsToken: boolean;
  needsSchemas: boolean;
  tokenContract: string;
  tokenSymbol: string;
  govSchemas: GovSchema[];
  threshold: number;
  hoursPerProposal: number;
  minimumWeight: number;
  minimumVotes: number;
  proposerType: string;
  authors: string[];
  proposalCost: number;
  description: string;
  avatar: string;
  coverImage: string;
  socials: DaoSocials;
  cheese: Pricing;
  waxdao: Pricing;
}

/** Builds the single Create DAO transaction exactly as the form always has. */
export function buildCreateDaoTransaction(i: CreateDaoTxInput) {
  const actions = [];

  if (i.paymentMethod === "cheese" && i.cheese.isAvailable && i.waxdao.isAvailable) {
    actions.push(buildCheesePaymentAction(i.accountName, i.cheese.formattedForTx, "dao", i.daoName));
    actions.push(buildAssertPointAction(i.accountName));
    actions.push(buildWaxdaoFeeAction(i.accountName, "dao.waxdao", i.waxdao.formattedForTx, "|dao_payment|"));
  } else if (i.paymentMethod === "wax" && i.waxdao.isAvailable) {
    actions.push(buildWaxPaymentAction(i.accountName, "dao", i.daoName));
    actions.push(buildAssertPointAction(i.accountName));
    actions.push(buildWaxdaoFeeAction(i.accountName, "dao.waxdao", i.waxdao.formattedForTx, "|dao_payment|"));
  }

  actions.push(buildCreateDaoAction(i.accountName, {
    daoName: i.daoName,
    daoType: i.daoType,
    tokenContract: i.needsToken ? i.tokenContract : undefined,
    tokenSymbol: i.needsToken ? i.tokenSymbol : undefined,
    govSchemas: i.needsSchemas ? i.govSchemas.filter(s => s.collection_name && s.schema_name) : undefined,
    threshold: i.threshold,
    hoursPerProposal: i.hoursPerProposal,
    minimumWeight: i.minimumWeight,
    minimumVotes: i.minimumVotes,
    proposerType: parseInt(i.proposerType),
    authors: Array.from(new Set([i.accountName, ...i.authors.map(a => a.trim().toLowerCase()).filter(Boolean)])),
    // dao.waxdao::createdao asserts proposal_cost must be in WAX.
    proposalCost: i.proposalCost,
    proposalCostSymbol: "WAX",
    proposalCostPrecision: 8,
  }));

  if (i.description || i.avatar || i.coverImage || Object.values(i.socials).some(v => v)) {
    actions.push(buildSetProfileActionWithSocials(
      i.accountName, i.daoName, i.description, i.avatar, i.coverImage, i.socials
    ));
  }

  return actions;
}
