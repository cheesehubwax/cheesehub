import { describe, it, expect } from "vitest";
import { isFarmFull } from "@/lib/farm";
import { assetCapacityRule, checkFarmCapacity, farmCapacitySummary } from '@/lib/farmCapacity';
import type { FarmInfo, FarmStakableConfig } from '@/lib/farm';

const now = 1_800_000_000;
const farm = (funds: string, hourly: string, hoursLeft = 100, status = 1) => ({
  status,
  expiration: now + hoursLeft * 3600,
  reward_pools: [{ contract: "c", symbol: "X", balance: "0", precision: 2, total_funds: funds, total_hourly_reward: hourly }],
});

const low = { template_id: 1, collection: 'col', hourly_rate: '0.01 X', hourly_rates: [{ contract: 'c', quantity: '0.01 X' }] };
const high = { ...low, template_id: 2, hourly_rate: '1.00 X', hourly_rates: [{ contract: 'c', quantity: '1.00 X' }] };
const config: FarmStakableConfig = { templates: [low, high], collections: [], schemas: [], attributes: [] };
const completeFarm = (funds = '101.00 X'): FarmInfo => ({ ...farm(funds, '1.00 X'), farm_name: 'test', creator: 'owner', logo: '', description: '', staked_count: 1, payout_interval: 3600, last_payout: now, farm_type: 2, time_created: now, is_active: true, id: 1 });

describe('per-NFT reward capacity', () => {
  it('keeps lower-rate templates available when higher-rate templates cannot fit', () => {
    expect(checkFarmCapacity(completeFarm(), [low], now)).toBe('available');
    expect(checkFarmCapacity(completeFarm(), [high], now)).toBe('blocked');
    expect(farmCapacitySummary(completeFarm(), config, now)).toBe('limited');
  });
  it('allows an exact fit and rejects one unit less in funds', () => {
    expect(checkFarmCapacity(completeFarm('101.00 X'), [low], now)).toBe('available');
    expect(checkFarmCapacity(completeFarm('100.99 X'), [low], now)).toBe('blocked');
  });
  it('checks the whole selected batch rather than each NFT independently', () => {
    expect(checkFarmCapacity(completeFarm(), [low, low], now)).toBe('blocked');
  });
  it('marks full only if every configured rate is blocked', () => {
    expect(farmCapacitySummary(completeFarm('100.00 X'), config, now)).toBe('full');
    expect(farmCapacitySummary(completeFarm('300.00 X'), config, now)).toBe('open');
  });
  it('checks every paying pool and distinguishes identical tickers by contract', () => {
    const f = completeFarm('300.00 X');
    f.reward_pools.push({ contract: 'other', symbol: 'X', precision: 2, balance: '0.00', total_funds: '0.00 X', total_hourly_reward: '0.00 X' });
    expect(checkFarmCapacity(f, [low], now)).toBe('available');
    expect(checkFarmCapacity(f, [{ hourly_rate: '0.01 X', hourly_rates: [{ contract: 'other', quantity: '0.01 X' }] }], now)).toBe('blocked');
    expect(checkFarmCapacity(f, [{ hourly_rate: '0.01 X' }], now)).toBe('unknown');
  });
  it('does not block a rule that pays zero into an already committed pool', () => {
    expect(checkFarmCapacity(completeFarm('100.00 X'), [{ hourly_rate: '0.00 X' }], now)).toBe('available');
  });
  it('does not silently treat missing or malformed pool data as zero', () => {
    const f = completeFarm();
    f.reward_pools[0].total_hourly_reward = undefined;
    expect(checkFarmCapacity(f, [low], now)).toBe('unknown');
    f.reward_pools[0].total_hourly_reward = 'bad';
    expect(checkFarmCapacity(f, [low], now)).toBe('unknown');
    expect(farmCapacitySummary(completeFarm(), undefined, now)).toBe('unknown');
  });
  it('does not mistake inactive farms for full farms', () => {
    const f = completeFarm();
    f.status = 0;
    expect(checkFarmCapacity(f, [low], now)).toBe('inactive');
    f.status = 1;
    f.expiration = now;
    expect(checkFarmCapacity(f, [low], now)).toBe('inactive');
  });
  it('uses the farm type to match collection, schema and template rates', () => {
    const c = { ...config, collections: [{ collection: 'col', hourly_rate: '2.00 X' }], schemas: [{ collection: 'col', schema: 's', hourly_rate: '3.00 X' }] };
    const asset = { collection: 'col', schema: 's', template_id: '1' };
    expect(assetCapacityRule(c, 0, asset)?.hourly_rate).toBe('2.00 X');
    expect(assetCapacityRule(c, 1, asset)?.hourly_rate).toBe('3.00 X');
    expect(assetCapacityRule(c, 2, asset)).toBe(low);
    expect(assetCapacityRule(c, 1, { ...asset, schema: 'other' })).toBeUndefined();
  });
  it('requires unambiguous attribute metadata instead of guessing', () => {
    const c = { ...config, attributes: [{ attribute_name: 'rarity', attribute_value: 'rare', hourly_rate: '2.00 X' }] };
    const asset = { collection: 'col', schema: 's', template_id: '1' };
    expect(assetCapacityRule(c, 3, asset)).toBeUndefined();
    expect(assetCapacityRule(c, 3, { ...asset, attributes: { rarity: 'rare' } })?.hourly_rate).toBe('2.00 X');
  });
});

describe("isFarmFull", () => {
  it("is full when committed rewards use up remaining funds", () => {
    expect(isFarmFull(farm("100.00 X", "1.00 X"), now)).toBe(true);
    expect(isFarmFull(farm("540.10 X", "0.85 X", 6808), now)).toBe(true);
  });
  it("has room when funds exceed the commitment", () => {
    expect(isFarmFull(farm("100.01 X", "1.00 X"), now)).toBe(false);
  });
  it("ignores pools that pay nothing yet", () => {
    expect(isFarmFull(farm("0.00 X", "0.00 X"), now)).toBe(false);
  });
  it("never marks expired or closed farms full", () => {
    expect(isFarmFull(farm("1.00 X", "1.00 X", -1), now)).toBe(false);
    expect(isFarmFull(farm("1.00 X", "1.00 X", 100, 2), now)).toBe(false);
  });
});
