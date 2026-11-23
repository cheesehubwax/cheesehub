import { describe, it, expect } from 'vitest';
import { cheeseWaxFromPool } from '@/hooks/useCheesePriceData';

const CHEESE = { symbol: 'CHEESE', contract: 'cheeseburger' };
const WAX = { symbol: 'WAX', contract: 'eosio.token' };

describe('cheeseWaxFromPool', () => {
  it('uses priceA when CHEESE is tokenA', () => {
    expect(cheeseWaxFromPool({ tokenA: CHEESE, tokenB: WAX, priceA: 1.5578, priceB: 0.641933 })).toBe(1.5578);
  });
  it('uses priceB when CHEESE is tokenB', () => {
    expect(cheeseWaxFromPool({ tokenA: WAX, tokenB: CHEESE, priceA: 0.641933, priceB: 1.5578 })).toBe(1.5578);
  });
  it('rejects a pool that is not CHEESE/WAX', () => {
    expect(cheeseWaxFromPool({ tokenA: { symbol: 'CHEESE', contract: 'fake' }, tokenB: WAX, priceA: 9 })).toBeUndefined();
  });
});
