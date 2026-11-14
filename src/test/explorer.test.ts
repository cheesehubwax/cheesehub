import { describe, expect, it } from 'vitest';
import { explorerAccount, explorerAsset, explorerTx } from '@/lib/explorer';
import { WAX_EXPLORER } from '@/lib/waxConfig';
import { txLink } from '@/lib/airdropCheese';

describe('WAX explorer destinations', () => {
  it('opens public accounts on Alcor Explorer', () => {
    expect(explorerAccount('m23qs.wam')).toBe('https://explorer.alcor.exchange/wax/account/m23qs.wam');
  });

  it('opens transactions on Alcor Explorer, including existing callers', () => {
    const expected = 'https://explorer.alcor.exchange/wax/transaction/abc123';
    expect(explorerTx('abc123')).toBe(expected);
    expect(`${WAX_EXPLORER}abc123`).toBe(expected);
    expect(txLink('abc123')).toBe(expected);
  });

  it('opens WAX NFT assets on AtomicHub', () => {
    expect(explorerAsset('1099511627776')).toBe('https://wax.atomichub.io/explorer/asset/wax-mainnet/1099511627776');
  });

  it('encodes identifiers as single path segments', () => {
    expect(explorerTx('a/b?c#d')).toBe('https://explorer.alcor.exchange/wax/transaction/a%2Fb%3Fc%23d');
    expect(explorerAccount('a/b')).toBe('https://explorer.alcor.exchange/wax/account/a%2Fb');
    expect(explorerAsset('a/b')).toBe('https://wax.atomichub.io/explorer/asset/wax-mainnet/a%2Fb');
  });
});