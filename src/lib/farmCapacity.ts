import type { FarmInfo, FarmStakableConfig, RewardRate } from './farmModel';

export type CapacityState = 'available' | 'blocked' | 'unknown' | 'inactive';
export interface CapacityRule {
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}
export interface CapacityAsset {
  collection: string;
  schema: string;
  template_id: string;
  attributes?: Record<string, unknown>;
}

function units(quantity: string, precision: number, symbol: string): bigint | null {
  const match = /^(\d+)(?:\.(\d+))?(?:\s+([A-Z]+))?$/.exec(quantity.trim());
  if (!match || (match[3] && match[3] !== symbol)) return null;
  const decimals = match[2] || '';
  if (decimals.length > precision || !Number.isInteger(precision) || precision < 0 || precision > 18) return null;
  return BigInt(match[1] + decimals.padEnd(precision, '0'));
}

/** Integer token units × seconds: equality fits; only excess is rejected. */
export function checkFarmCapacity(farm: Pick<FarmInfo, 'status' | 'expiration' | 'reward_pools'>, rules: CapacityRule[], now: number): CapacityState {
  if (farm.status !== 1 || farm.expiration <= now) return 'inactive';
  if (!rules.length || !farm.reward_pools.length) return 'unknown';
  const additions = new Map<number, bigint>();
  for (const rule of rules) {
    const rates = rule.hourly_rates?.length ? rule.hourly_rates : [{ quantity: rule.hourly_rate }];
    for (const rate of rates) {
      if (/^0(?:\.0+)?$/.test(rate.quantity.trim())) continue;
      const symbol = rate.quantity.trim().split(/\s+/)[1];
      const matches = farm.reward_pools.map((pool, index) => ({ pool, index })).filter(({ pool }) =>
        pool.symbol === symbol && (!rate.contract || pool.contract === rate.contract));
      const match = matches.length === 1 ? matches[0] : undefined;
      if (!match) return 'unknown';
      const amount = units(rate.quantity, match.pool.precision, match.pool.symbol);
      if (amount === null) return 'unknown';
      additions.set(match.index, (additions.get(match.index) || 0n) + amount);
    }
  }
  const seconds = BigInt(Math.max(0, Math.ceil(farm.expiration - now)));
  let unknown = false;
  for (const [index, added] of additions) {
    if (added === 0n) continue;
    const pool = farm.reward_pools[index];
    const funds = units(pool.total_funds ?? pool.balance, pool.precision, pool.symbol);
    const hourly = pool.total_hourly_reward ? units(pool.total_hourly_reward, pool.precision, pool.symbol) : null;
    if (funds === null || hourly === null) { unknown = true; continue; }
    if ((hourly + added) * seconds > funds * 3600n) return 'blocked';
  }
  return unknown ? 'unknown' : 'available';
}

export function farmCapacityRules(config: FarmStakableConfig, type: number): CapacityRule[] {
  return [config.collections, config.schemas, config.templates, config.attributes][type] || [];
}

export function assetCapacityRule(config: FarmStakableConfig, type: number, asset: CapacityAsset): CapacityRule | undefined {
  switch (type) {
    case 0: return config.collections.find(rule => rule.collection === asset.collection);
    case 1: return config.schemas.find(rule => rule.collection === asset.collection && rule.schema === asset.schema);
    case 2: return config.templates.find(rule => String(rule.template_id) === String(asset.template_id));
    // Attribute metadata must be present; never guess an NFT's reward rate.
    case 3: {
      const matches = config.attributes.filter(rule => asset.attributes?.[rule.attribute_name] !== undefined &&
        String(asset.attributes[rule.attribute_name]) === rule.attribute_value);
      return matches.length === 1 ? matches[0] : undefined;
    }
    default: return undefined;
  }
}

export function farmCapacitySummary(farm: FarmInfo, config: FarmStakableConfig | undefined, now: number): 'full' | 'limited' | 'open' | 'unknown' {
  if (!config || farm.status !== 1 || farm.expiration <= now) return 'unknown';
  const states = farmCapacityRules(config, farm.farm_type).map(rule => checkFarmCapacity(farm, [rule], now));
  if (!states.length) return 'unknown';
  const blocked = states.filter(state => state === 'blocked').length;
  if (blocked === states.length) return 'full';
  if (blocked > 0) return 'limited';
  return states.includes('unknown') ? 'unknown' : 'open';
}