// Farm creation transaction plan: the fee legs (CHEESE or WAX via cheesefeefee,
// then assertpoint + WAXDAO fee to farms.waxdao) followed by createfarm.
// Pure so the exact signed action order is covered by tests.

import { buildAssertPointAction, buildCreateFarmAction } from "./farmActions";
import type { FarmType, RewardToken } from "./farmModel";
import { buildCheesePaymentAction, buildWaxPaymentAction, buildWaxdaoFeeAction } from "./cheeseFees";

export interface CreateFarmForm {
  farmName: string;
  avatar: string;
  coverImage: string;
  description: string;
  hoursBetweenPayouts: string;
  farmType: FarmType;
  twitter: string;
  discord: string;
  telegram: string;
  website: string;
  youtube: string;
  medium: string;
}

export interface CreateFarmPricing {
  cheeseAvailable: boolean;
  cheeseForTx: string;
  waxdaoAvailable: boolean;
  waxdaoForTx: string;
}

export const MIN_PAYOUT_HOURS = 1;
export const MAX_PAYOUT_HOURS = 720;

/** Returns the user-facing error, or null when the form can be submitted. */
export function validateCreateFarmForm(form: CreateFarmForm, rewardTokens: RewardToken[], paymentMethod: "wax" | "cheese" | null): string | null {
  const hours = parseInt(form.hoursBetweenPayouts);
  if (isNaN(hours) || hours < MIN_PAYOUT_HOURS || hours > MAX_PAYOUT_HOURS) return "Hours between payouts must be between 1 and 720";
  if (!rewardTokens.every(t => t.contract.trim() && t.symbol.trim())) return "All reward tokens must have a contract and symbol";
  if (!paymentMethod) return "Please select a payment method";
  return null;
}

export function buildCreateFarmTransaction(
  account: string,
  form: CreateFarmForm,
  rewardTokens: RewardToken[],
  paymentMethod: "wax" | "cheese",
  pricing: CreateFarmPricing,
) {
  const actions: unknown[] = [];
  if (paymentMethod === "cheese" && pricing.cheeseAvailable && pricing.waxdaoAvailable) {
    actions.push(buildCheesePaymentAction(account, pricing.cheeseForTx, "farm", form.farmName));
    actions.push(buildAssertPointAction(account));
    actions.push(buildWaxdaoFeeAction(account, "farms.waxdao", pricing.waxdaoForTx, "|create_farm|"));
  } else if (pricing.waxdaoAvailable) {
    actions.push(buildWaxPaymentAction(account, "farm", form.farmName));
    actions.push(buildAssertPointAction(account));
    actions.push(buildWaxdaoFeeAction(account, "farms.waxdao", pricing.waxdaoForTx, "|create_farm|"));
  }
  actions.push(buildCreateFarmAction(
    account,
    form.farmName,
    form.farmType,
    parseInt(form.hoursBetweenPayouts),
    rewardTokens.filter(t => t.contract && t.symbol),
    { avatar: form.avatar.trim(), cover_image: form.coverImage.trim(), description: form.description.trim() },
    {
      atomichub: "",
      discord: form.discord.trim(),
      medium: form.medium.trim(),
      telegram: form.telegram.trim(),
      twitter: form.twitter.trim(),
      waxdao: "",
      website: form.website.trim(),
      youtube: form.youtube.trim(),
    },
  ));
  return actions;
}
