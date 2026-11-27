import { describe, expect, it } from 'vitest';
import { agePoints, balancePoints, keyAgePoints, markFor, MAX_TOTAL_POINTS, nftPoints, poolPoints, scoreTrust, stakePoints, type TrustSignals } from '@/lib/cryptTrust';

const DAY = 86_400_000, YEAR = 365 * DAY, NOW = Date.UTC(2026, 10, 7);
const base: TrustSignals = { account: 'someone1', createdAt: NOW - 2 * YEAR, cheese: 0, staked: 0, pooled: { cheese: 0, pools: 0 }, nfts: 0, key: { published: false, firstAt: null } };

describe('crypt trust strength', () => {
  it('premium .cheese/.chz names score +40', () => {
    const plain = scoreTrust(base, NOW).total;
    expect(scoreTrust({ ...base, account: 'bob.cheese' }, NOW).total - plain).toBe(40);
    expect(scoreTrust({ ...base, account: 'bob.chz' }, NOW).total - plain).toBe(40);
  });
  it('account age tiers', () => {
    expect(agePoints(6 * DAY)).toBe(-15);
    expect(agePoints(7 * DAY)).toBe(2);
    expect(agePoints(30 * DAY)).toBe(5);
    expect(agePoints(YEAR)).toBe(10);
    expect(agePoints(3 * YEAR)).toBe(15);
    expect(agePoints(5 * YEAR)).toBe(20);
  });
  it('CHEESE balance tiers', () => {
    expect(balancePoints(0.5)).toBe(0);
    expect(balancePoints(99)).toBe(2);
    expect(balancePoints(100)).toBe(6);
    expect(balancePoints(1000)).toBe(12);
    expect(balancePoints(10_000)).toBe(20);
    expect(balancePoints(49_999)).toBe(20);
    expect(balancePoints(50_000)).toBe(30);
  });
  it('faucet stake tiers', () => {
    expect(stakePoints(99)).toBe(0);
    expect(stakePoints(100)).toBe(5);
    expect(stakePoints(4999)).toBe(5);
    expect(stakePoints(5000)).toBe(10);
    expect(stakePoints(19_999)).toBe(10);
    expect(stakePoints(20_000)).toBe(15);
    expect(stakePoints(49_999)).toBe(15);
    expect(stakePoints(50_000)).toBe(20);
    expect(stakePoints(1_000_000)).toBe(20);
  });
  it('pooled CHEESE tiers with +5 for 2 or more pools', () => {
    expect(poolPoints(0, 0)).toBe(0);
    expect(poolPoints(50, 1)).toBe(0);
    expect(poolPoints(99.9999, 2)).toBe(0);
    expect(poolPoints(100, 1)).toBe(1);
    expect(poolPoints(999, 1)).toBe(1);
    expect(poolPoints(1000, 1)).toBe(5);
    expect(poolPoints(4999, 1)).toBe(5);
    expect(poolPoints(5000, 1)).toBe(15);
    expect(poolPoints(19_999, 1)).toBe(15);
    expect(poolPoints(20_000, 1)).toBe(35);
    expect(poolPoints(49_999, 1)).toBe(35);
    expect(poolPoints(50_000, 1)).toBe(70);
    expect(poolPoints(99_999, 1)).toBe(70);
    expect(poolPoints(100_000, 1)).toBe(100);
    expect(poolPoints(100_000, 2)).toBe(105);
    expect(poolPoints(1_000_000, 7)).toBe(105);
  });
  it('NFT and key age tiers', () => {
    expect([nftPoints(1), nftPoints(5), nftPoints(20), nftPoints(50)]).toEqual([4, 10, 18, 25]);
    expect([keyAgePoints(29 * DAY), keyAgePoints(30 * DAY), keyAgePoints(182 * DAY), keyAgePoints(YEAR)]).toEqual([0, 3, 6, 10]);
  });
  it('mark thresholds and the new-account override', () => {
    expect([markFor(9, false), markFor(10, false), markFor(40, false), markFor(100, false), markFor(150, false)]).toEqual(['warning', 'low', 'moderate', 'good', 'strong']);
    expect([markFor(39, false), markFor(99, false), markFor(149, false)]).toEqual(['low', 'moderate', 'good']);
    expect([markFor(199, false), markFor(200, false), markFor(224, false)]).toEqual(['strong', 'huge', 'huge']);
    expect(markFor(220, true)).toBe('warning');
    expect(scoreTrust({ ...base, account: 'new.cheese', createdAt: NOW - 3 * DAY, cheese: 100_000 }, NOW).mark).toBe('warning');
  });
  it('unknown signals are left out and mark the score partial', () => {
    const s = scoreTrust({ ...base, cheese: null, createdAt: NOW - 2 * YEAR }, NOW);
    expect(s.partial).toBe(true);
    expect(s.total).toBe(10);
    expect(s.lines.find(l => l.id === 'cheese')?.points).toBeNull();
  });
  it('key age counts only while a key is published; no shared-room or past-chat points', () => {
    const k = scoreTrust({ ...base, key: { published: true, firstAt: NOW - 2 * YEAR } }, NOW);
    expect(k.total).toBe(10 + 10 + 10);
    expect(k.lines.some(l => l.id === 'rooms' || l.id === 'chat')).toBe(false);
    expect(scoreTrust({ ...base, key: { published: false, firstAt: NOW - 2 * YEAR } }, NOW).total).toBe(10);
  });
  it('all maximum signals sum to 260 with liquidity contributing 105', () => {
    const score = scoreTrust({ ...base, account: 'bob.chz', createdAt: NOW - 5 * YEAR, cheese: 50_000, staked: 50_000, pooled: { cheese: 100_000, pools: 2 }, nfts: 50, key: { published: true, firstAt: NOW - YEAR } }, NOW);
    expect(MAX_TOTAL_POINTS).toBe(260);
    expect(score.total).toBe(260);
    expect(score.mark).toBe('huge');
    expect(score.partial).toBe(false);
    expect(score.lines.find(l => l.id === 'pool')).toMatchObject({ points: 105, max: 105 });
    expect(score.lines.find(l => l.id === 'age')).toMatchObject({ points: 20, max: 20 });
    expect(score.lines.find(l => l.id === 'stake')).toMatchObject({ points: 20, max: 20 });
  });
});
