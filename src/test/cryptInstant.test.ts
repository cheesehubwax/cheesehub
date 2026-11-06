import { describe, expect, it } from 'vitest';
import {
  buildEnableActions, buildRevokeActions, generateInstantKey, instantReady, isInstantEligible, needsRam,
  parseInstantStatus, ramTopUpQuantity, sendInstant, INSTANT_PERMISSION,
} from '@/lib/cryptInstant';
import type { CheeseRamConfig } from '@/lib/cheeseRam';

const auth = [{ actor: 'alice', permission: 'active' }];
const sendfree = { account: 'crypt.cheese', name: 'sendfree', data: { sender: 'alice', parts: 1, copies: [] } };
const acct = (perms: unknown[], quota = 10000, usage = 9000) => ({ ram_quota: quota, ram_usage: usage, permissions: perms });

describe('Instant Messaging permission', () => {
  it('links the browser permission to crypt.cheese::sendfree only, parented to active', () => {
    const k = generateInstantKey('alice');
    const acts = buildEnableActions('alice', auth, k.publicKey, { linked: false });
    expect(acts.map(a => `${a.account}::${a.name}`)).toEqual(['eosio::updateauth', 'eosio::linkauth']);
    expect(acts[0].data).toMatchObject({ account: 'alice', permission: INSTANT_PERMISSION, parent: 'active',
      auth: { threshold: 1, keys: [{ key: k.publicKey, weight: 1 }], accounts: [], waits: [] } });
    expect(acts[1].data).toEqual({ account: 'alice', code: 'crypt.cheese', type: 'sendfree', requirement: INSTANT_PERMISSION });
  });

  it('prepends a ram.chz purchase for the same account when RAM is short', () => {
    const acts = buildEnableActions('alice', auth, generateInstantKey('alice').publicKey, { linked: true, ramQuantity: '1.0000 CHEESE' });
    expect(acts[0]).toMatchObject({ account: 'cheeseburger', name: 'transfer', data: { from: 'alice', to: 'ram.chz', quantity: '1.0000 CHEESE', memo: '' } });
    expect(acts.some(a => a.name === 'linkauth')).toBe(false);
  });

  it('revokes by unlinking before deleting the permission', () => {
    const s = parseInstantStatus(acct([{ perm_name: INSTANT_PERMISSION, parent: 'active', required_auth: { keys: [{ key: 'x' }] }, linked_actions: [{ account: 'crypt.cheese', action: 'sendfree' }] }]));
    expect(buildRevokeActions('alice', auth, s).map(a => a.name)).toEqual(['unlinkauth', 'deleteauth']);
  });

  it('is ready only when this browser key is the sole key and the link exists', () => {
    const k = generateInstantKey('alice');
    const perm = (keys: string[], linked: boolean) => parseInstantStatus(acct([{ perm_name: INSTANT_PERMISSION, parent: 'active',
      required_auth: { threshold: 1, keys: keys.map(key => ({ key, weight: 1 })) }, linked_actions: linked ? [{ account: 'crypt.cheese', action: 'sendfree' }] : [] }]));
    expect(instantReady(perm([k.publicKey], true), k)).toBe(true);
    expect(instantReady(perm([k.publicKey], false), k)).toBe(false);
    expect(instantReady(perm([generateInstantKey('alice').publicKey], true), k)).toBe(false);
    expect(instantReady(perm([k.publicKey, generateInstantKey('alice').publicKey], true), k)).toBe(false);
  });

  it('only signs a lone sendfree from the same account', async () => {
    expect(isInstantEligible([sendfree], 'alice')).toBe(true);
    expect(isInstantEligible([sendfree], 'bob')).toBe(false);
    expect(isInstantEligible([{ ...sendfree, name: 'sendmsg' }], 'alice')).toBe(false);
    expect(isInstantEligible([{ account: 'cheeseburger', name: 'transfer', data: { from: 'alice' } }], 'alice')).toBe(false);
    expect(isInstantEligible([sendfree, sendfree], 'alice')).toBe(false);
    await expect(sendInstant({} as never, generateInstantKey('alice'), [{ account: 'cheeseburger', name: 'transfer', data: {} }])).rejects.toThrow();
  });
});

describe('Instant Messaging RAM check', () => {
  it('needs RAM below 1500 free bytes when the permission does not exist yet', () => {
    expect(needsRam(parseInstantStatus(acct([], 10000, 9000)))).toBe(true);   // 1000 free
    expect(needsRam(parseInstantStatus(acct([], 10000, 8000)))).toBe(false);  // 2000 free
  });

  const config = { enabled: true, minCheese: 1, maxCheese: 100, referenceRate: 1.3333, buySpreadBps: 50 } as CheeseRamConfig;
  it('buys at least ram.chz minimum CHEESE and none when ram.chz is off', () => {
    expect(ramTopUpQuantity(config, 0.00042)).toBe('1.0000 CHEESE');
    expect(ramTopUpQuantity({ ...config, enabled: false }, 0.00042)).toBeNull();
    expect(ramTopUpQuantity(config, 0.01)).toMatch(/^\d+\.\d{4} CHEESE$/);
  });
});
