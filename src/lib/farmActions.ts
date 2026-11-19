// WaxDAO V2 Farm Contract (farms.waxdao) — transaction action builders.

import { FARM_CONTRACT, FARM_CREATION_FEES, FARM_TYPE_VALUES, type FarmType, type RewardToken, type FarmSocials } from "./farmModel";

// Build action for assertpoint (required before fee payment)
export function buildAssertPointAction(user: string) {
  return {
    account: FARM_CONTRACT,
    name: "assertpoint",
    authorization: [{ actor: user, permission: "active" }],
    data: { user },
  };
}

// Build action for paying farm creation fee with WAX
export function buildFarmCreationFeeWaxAction(sender: string) {
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity: FARM_CREATION_FEES.WAX,
      memo: "|create_farm|",
    },
  };
}

// Build action for paying farm creation fee with WAXDAO
export function buildFarmCreationFeeWaxdaoAction(sender: string) {
  return {
    account: "mdcryptonfts",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity: FARM_CREATION_FEES.WAXDAO,
      memo: "|create_farm|",
    },
  };
}

// Build action for paying farm creation fee with Wojak NFT
export function buildFarmCreationFeeWojakAction(sender: string, assetId: string) {
  return {
    account: "atomicassets",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      asset_ids: [assetId],
      memo: "|create_farm|",
    },
  };
}

// Build action for creating farm
export function buildCreateFarmAction(
  user: string,
  farmName: string,
  farmType: FarmType,
  hoursBetweenPayouts: number,
  rewardTokens: RewardToken[],
  profile: {
    avatar: string;
    cover_image: string;
    description: string;
  },
  socials: {
    website: string;
    telegram: string;
    discord: string;
    twitter: string;
    medium: string;
    youtube: string;
    atomichub: string;
    waxdao: string;
  }
) {
  return {
    account: FARM_CONTRACT,
    name: "createfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      farm_type: FARM_TYPE_VALUES[farmType],
      hours_between_payouts: hoursBetweenPayouts,
      reward_tokens: rewardTokens.map(t => ({
        contract: t.contract,
        token_symbol: `${t.precision},${t.symbol}`,
      })),
      profile,
      socials,
    },
  };
}

// RewardValue type for V2 farm stakable assets
export interface RewardValue {
  quantity: string;
  contract: string;
}

const MAX_VALUES_PER_ACTION = 50;

function toArray<T>(input: T | T[]): T[] {
  return Array.isArray(input) ? input : [input];
}

function mapRewards(rewardValues: RewardValue[]) {
  return rewardValues.map(rv => ({ quantity: rv.quantity, contract: rv.contract }));
}

/** Split a values vector into chunks so a single action never gets too large. */
export function chunkValues<T>(values: T[], size: number = MAX_VALUES_PER_ACTION): T[][] {
  if (values.length <= size) return [values];
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

// Build action for setting template values (V2) — accepts one or many template IDs
export function buildSetTemplateValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  templateId: number | number[],
  rewardValues: RewardValue[]
) {
  const hourly_rewards = mapRewards(rewardValues);
  return {
    account: FARM_CONTRACT,
    name: "settmpvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: toArray(templateId).map(id => ({
        template_id: id,
        collection_name: collectionName,
        hourly_rewards,
      })),
    },
  };
}

// Build action for setting schema values (V2) — accepts one or many schema names
export function buildSetSchemaValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  schemaName: string | string[],
  rewardValues: RewardValue[]
) {
  const hourly_rewards = mapRewards(rewardValues);
  return {
    account: FARM_CONTRACT,
    name: "setschvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: toArray(schemaName).map(schema => ({
        collection_name: collectionName,
        schema_name: schema,
        hourly_rewards,
      })),
    },
  };
}

// Build action for setting collection values (V2) — accepts one or many collections
export function buildSetCollectionValuesAction(
  user: string,
  farmname: string,
  collectionName: string | string[],
  rewardValues: RewardValue[]
) {
  const hourly_rewards = mapRewards(rewardValues);
  return {
    account: FARM_CONTRACT,
    name: "setcolvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: toArray(collectionName).map(collection => ({
        collection_name: collection,
        hourly_rewards,
      })),
    },
  };
}

// Build action for setting attribute values (V2) — accepts one or many attribute values
export function buildSetAttributeValuesAction(
  user: string,
  farmname: string,
  attributeName: string,
  attributeValue: string | string[],
  rewardValues: RewardValue[]
) {
  const hourly_rewards = mapRewards(rewardValues);
  return {
    account: FARM_CONTRACT,
    name: "setattvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: toArray(attributeValue).map(value => ({
        attribute_name: attributeName,
        attribute_value: value,
        hourly_rewards,
      })),
    },
  };
}


// Build action for erasing template values
export function buildEraseTemplateValuesAction(user: string, farmname: string, templateId: number) {
  return {
    account: FARM_CONTRACT,
    name: "removetemp",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, template_id: templateId },
  };
}

// Build action for erasing schema values
export function buildEraseSchemaValuesAction(user: string, farmname: string, collectionName: string, schemaName: string) {
  return {
    account: FARM_CONTRACT,
    name: "removeschema",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, collection_name: collectionName, schema_name: schemaName },
  };
}

// Build action for erasing collection values
export function buildEraseCollectionValuesAction(user: string, farmname: string, collectionName: string) {
  return {
    account: FARM_CONTRACT,
    name: "removecol",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, collection_name: collectionName },
  };
}

// Build action for erasing attribute values
export function buildEraseAttributeValuesAction(user: string, farmname: string, attributeName: string, attributeValue: string) {
  return {
    account: FARM_CONTRACT,
    name: "eraseattvalue",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, attribute_name: attributeName, attribute_value: attributeValue },
  };
}

// Build action for closing an expired farm
export function buildCloseFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "closefarm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName },
  };
}

// Build action for permanently closing a farm
export function buildPermCloseFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "permclosefrm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName },
  };
}

// Build action for kicking multiple stakers from a farm
export function buildKickManyAction(user: string, farmName: string, amount: number) {
  return {
    account: FARM_CONTRACT,
    name: "kickmany",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName, quantity_of_users: amount },
  };
}

// Build action for emptying reward tokens from a permanently closed farm
export function buildEmptyFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "emptyfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName },
  };
}

// Build action for depositing reward tokens
export function buildAddRewardsAction(sender: string, farmName: string, tokenContract: string, quantity: string) {
  return {
    account: tokenContract,
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity,
      memo: `|farm_deposit|${farmName}|`,
    },
  };
}

// Build action for opening a farm (sets expiration and activates it)
export function buildOpenFarmAction(creator: string, farmName: string, expiration: number) {
  return {
    account: FARM_CONTRACT,
    name: "openfarm",
    authorization: [{ actor: creator, permission: "active" }],
    data: { user: creator, farmname: farmName, expiration },
  };
}

// Build action for extending farm expiration
export function buildExtendFarmAction(user: string, farmName: string, newExpiration: number) {
  return {
    account: FARM_CONTRACT,
    name: "extendfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName, expiration: newExpiration },
  };
}

// Build action for withdrawing excess rewards from an active farm
export function buildWithdrawRewardsAction(user: string, farmName: string, tokenContract: string, quantity: string) {
  return {
    account: FARM_CONTRACT,
    name: "withdraw",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farm_name: farmName,
      amount: { quantity, contract: tokenContract },
    },
  };
}

// Build action for staking NFTs to a farm
export function buildStakeNftsAction(staker: string, farmName: string, assetIds: string[]) {
  return {
    account: FARM_CONTRACT,
    name: "stakenfts",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, farmname: farmName, assets_to_stake: assetIds },
  };
}

// Build action for unstaking NFTs from a farm
export function buildUnstakeNftsAction(staker: string, farmName: string, assetIds: string[]) {
  return {
    account: FARM_CONTRACT,
    name: "unstake",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, farmname: farmName, asset_ids: assetIds },
  };
}

// Build action for claiming rewards
export function buildClaimRewardsAction(staker: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "claim",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, farmname: farmName },
  };
}

// Build action for setting farm profile
export function buildSetFarmProfileAction(
  user: string,
  farmName: string,
  profile: { avatar: string; cover_image: string; description: string },
  socials: FarmSocials
) {
  return {
    account: FARM_CONTRACT,
    name: "setprofile",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      profile: {
        avatar: profile.avatar || "",
        cover_image: profile.cover_image || "",
        description: profile.description || "",
      },
      socials: {
        atomichub: socials.atomichub || "",
        discord: socials.discord || "",
        medium: socials.medium || "",
        telegram: socials.telegram || "",
        twitter: socials.twitter || "",
        waxdao: socials.waxdao || "",
        website: socials.website || "",
        youtube: socials.youtube || "",
      },
    },
  };
}

