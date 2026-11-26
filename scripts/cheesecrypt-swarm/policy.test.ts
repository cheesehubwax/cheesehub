import { describe, expect, test } from 'bun:test';
import { boxBytes, buildSend, burstAllowed, checkPermission, cheese, dummyMemo, isOrganic, planBurst, poissonDelayMs, pickRecipient, refuseSend, validateConfig, SEND_COST_UNITS } from './policy';

const base = {
  bots: [
    { account: 'alpha.chz', permission: 'cheesecrypt', privateKey: 'PVT_K1_x' },
    { account: 'brie.chz', permission: 'cheesecrypt', privateKey: 'PVT_K1_y' },
    { account: 'gouda.chz', permission: 'cheesecrypt', privateKey: 'PVT_K1_z' },
  ],
  trickleRatePerHour: 0.5, burstMin: 1, burstMax: 2, burstDelayMinSeconds: 30, burstDelayMaxSeconds: 600,
  maxBurstsPerHour: 4, maxSendsPerBotPerDay: 40, reserve: '1.0000 CHEESE',
  chainApi: ['https://wax.greymass.com'], hyperion: ['https://wax.eosusa.io'], broadcast: 'direct',
};

describe('swarm policy', () => {
  test('decoy memos are exactly 256 bytes, the length of every real padded CRYPT2 memo', () => {
    expect(boxBytes()).toBe(162);
    const m = dummyMemo(n => new Uint8Array(n));
    expect(m.startsWith('CRYPT2:')).toBe(true);
    expect(new TextEncoder().encode(m).length).toBe(256);
  });
  test('send shape: 0.0101 CHEESE to crypt.cheese then one-part sendmsg', () => {
    const [pay, send] = buildSend('alpha.chz', 'cheesecrypt', 'brie.chz', 'CRYPT2:a:b');
    expect(pay.data).toEqual({ from: 'alpha.chz', to: 'crypt.cheese', quantity: '0.0101 CHEESE', memo: 'CHEESECrypt messaging fee' });
    expect(send.data).toEqual({ sender: 'alpha.chz', parts: 1, copies: [{ to: 'brie.chz', memo: 'CRYPT2:a:b' }] });
    expect(() => buildSend('alpha.chz', 'cheesecrypt', 'alpha.chz', 'x')).toThrow();
    expect(cheese(SEND_COST_UNITS)).toBe('0.0101 CHEESE');
  });
  test('config refuses owner/active permissions, one bot, and non-loopback broadcast', () => {
    expect(validateConfig(base).bots.length).toBe(3);
    expect(() => validateConfig({ ...base, bots: [{ ...base.bots[0], permission: 'active' }, base.bots[1]] })).toThrow();
    expect(() => validateConfig({ ...base, bots: [base.bots[0]] })).toThrow();
    expect(() => validateConfig({ ...base, broadcast: 'http://example.com:8088' })).toThrow();
    expect(validateConfig({ ...base, broadcast: 'http://127.0.0.1:8088' }).broadcast).toBe('http://127.0.0.1:8088');
  });
  test('recipient is never the sender', () => {
    for (const u of [0, 0.3, 0.6, 0.999]) expect(pickRecipient(['a', 'b', 'c'], 'b', u)).not.toBe('b');
  });
  test('poisson gap: rate 1/h at u=1-1/e is one hour; rate 0 never fires', () => {
    expect(poissonDelayMs(1, 1 - Math.exp(-1))).toBe(3_600_000);
    expect(poissonDelayMs(0, 0.5)).toBe(Infinity);
  });
  test('burst uses distinct bots within the delay window', () => {
    let s = 0.123; const rand = () => (s = (s * 9301 + 0.49297) % 1);
    const b = planBurst(validateConfig(base), rand);
    expect(b.length).toBeGreaterThanOrEqual(1); expect(b.length).toBeLessThanOrEqual(2);
    expect(new Set(b.map(x => x.sender)).size).toBe(b.length);
    for (const x of b) { expect(x.delayMs).toBeGreaterThanOrEqual(30_000); expect(x.delayMs).toBeLessThanOrEqual(600_000); }
  });
  test('bots never trigger bursts for each other', () => {
    const bots = new Set(['alpha.chz']);
    expect(isOrganic({ act: { name: 'sendmsg', authorization: [{ actor: 'alpha.chz' }] } }, bots)).toBe(false);
    expect(isOrganic({ act: { name: 'sendfree', authorization: [{ actor: 'someone' }] } }, bots)).toBe(true);
    expect(isOrganic({ act: { name: 'payfee', authorization: [{ actor: 'someone' }] } }, bots)).toBe(false);
  });
  test('caps: daily limit, reserve and burst rate', () => {
    expect(refuseSend(40, 40, 1_000_000, 0)).toBe('daily cap reached');
    expect(refuseSend(0, 40, 10_101, 10_000)).toBeNull();
    expect(refuseSend(0, 40, 10_100, 10_000)).toBe('would go below reserve');
    expect(burstAllowed([0, 1, 2, 3], 10, 4)).toBe(false);
    expect(burstAllowed([0, 1, 2, 3], 3_600_001 + 3, 4)).toBe(true);
  });
  test('key on active is refused; extra links are refused', () => {
    const acc = (links?: { account: string; action?: string }[], activeKey = 'K2') => ({ permissions: [
      { perm_name: 'active', required_auth: { keys: [{ key: activeKey }] } },
      { perm_name: 'cheesecrypt', required_auth: { keys: [{ key: 'K1' }] }, linked_actions: links },
    ] });
    const ok = [{ account: 'cheeseburger', action: 'transfer' }, { account: 'crypt.cheese', action: 'sendmsg' }];
    expect(checkPermission(acc(ok), 'cheesecrypt', ['K1'])).toBeNull();
    expect(checkPermission(acc(ok, 'K1'), 'cheesecrypt', ['K1'])).toContain('active');
    expect(checkPermission(acc([...ok, { account: 'eosio.token' }]), 'cheesecrypt', ['K1'])).toContain('more than');
  });
});
