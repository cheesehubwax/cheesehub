import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { validateConfig, validateNightRunnerConfig, nightKey, nightBounds, planNight, dueNight, NIGHT_LATE_MS, type NightConfig } from './policy';

const bots = [
  { account: 'alpha.chz', permission: 'cheesecrypt', privateKey: 'PVT_K1_x' },
  { account: 'brie.chz', permission: 'cheesecrypt', privateKey: 'PVT_K1_y' },
  { account: 'gouda.chz', permission: 'cheesecrypt', privateKey: 'PVT_K1_z' },
];
const base = {
  bots, trickleRatePerHour: 0.5, burstMin: 1, burstMax: 2, burstDelayMinSeconds: 30, burstDelayMaxSeconds: 600,
  maxBurstsPerHour: 4, maxSendsPerBotPerDay: 40, reserve: '1.0000 CHEESE',
  chainApi: ['https://wax.greymass.com'], hyperion: ['https://wax.eosusa.io'], broadcast: 'direct',
};
const night: NightConfig = {
  enabled: true, timezone: 'Australia/Brisbane', start: '23:00', end: '06:30', sendsMin: 1, sendsMax: 3,
  skipNightChance: 0, replyChance: 1, replyDelayMinSeconds: 180, replyDelayMaxSeconds: 900, senders: ['alpha.chz', 'brie.chz'],
};
const accounts = bots.map(b => b.account);
let seed = 1;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('night schedule', () => {
  test('both shipped examples validate with night strictly disabled by default', () => {
    const daytime = validateConfig(JSON.parse(readFileSync(new URL('./config.example.json', import.meta.url), 'utf8')));
    const standalone = validateNightRunnerConfig(JSON.parse(readFileSync(new URL('./night-config.example.json', import.meta.url), 'utf8')));
    expect(daytime.bots.length).toBe(2);
    expect(daytime.night).toBeUndefined();
    expect(standalone.night.enabled).toBe(false);
  });
  test('window crossing midnight in Brisbane (UTC+10)', () => {
    expect(nightKey(Date.parse('2026-11-27T13:30:00Z'), night)).toBe('2026-11-27'); // 23:30 local
    expect(nightKey(Date.parse('2026-11-27T19:00:00Z'), night)).toBe('2026-11-27'); // 05:00 next day local
    expect(nightKey(Date.parse('2026-11-27T21:00:00Z'), night)).toBeNull();         // 07:00 local
    const b = nightBounds('2026-11-27', night);
    expect(new Date(b.startMs).toISOString()).toBe('2026-11-27T13:00:00.000Z');
    expect(new Date(b.endMs).toISOString()).toBe('2026-11-27T20:30:00.000Z');
  });
  test('DST: London window is 23:00 local both sides of the October change', () => {
    const n = { ...night, timezone: 'Europe/London' };
    expect(new Date(nightBounds('2026-07-01', n).startMs).toISOString()).toBe('2026-07-01T22:00:00.000Z');
    expect(new Date(nightBounds('2026-12-01', n).startMs).toISOString()).toBe('2026-12-01T23:00:00.000Z');
  });
  test('plans stay inside the window, within counts, never self-send, senders only from config, no round minutes', () => {
    for (let i = 0; i < 300; i++) {
      const p = planNight(night, accounts, '2026-11-27', rng);
      const { startMs, endMs } = nightBounds('2026-11-27', night);
      const starts = p.filter(e => !e.id.endsWith('r'));
      expect(starts.length).toBeGreaterThanOrEqual(1); expect(starts.length).toBeLessThanOrEqual(3);
      for (const e of p) {
        expect(e.atMs).toBeGreaterThanOrEqual(startMs); expect(e.atMs).toBeLessThan(endMs);
        expect(e.sender).not.toBe(e.recipient);
        expect(e.atMs % 60_000).toBeGreaterThanOrEqual(1000);
      }
      for (const e of starts) expect(night.senders).toContain(e.sender);
    }
  });
  test('replies swap the pair and land 180–900 s after their message', () => {
    const p = planNight(night, accounts, '2026-11-27', rng);
    for (const r of p.filter(e => e.id.endsWith('r'))) {
      const o = p.find(e => e.id === r.id.slice(0, -1));
      if (!o) throw new Error('missing reply origin');
      expect(r.sender).toBe(o.recipient); expect(r.recipient).toBe(o.sender);
      expect(r.atMs - o.atMs).toBeGreaterThanOrEqual(180_000); expect(r.atMs - o.atMs).toBeLessThan(960_000);
    }
  });
  test('skip chance 1 or disabled plans nothing', () => {
    expect(planNight({ ...night, skipNightChance: 1 }, accounts, '2026-11-27', rng)).toEqual([]);
    expect(planNight({ ...night, enabled: false }, accounts, '2026-11-27', rng)).toEqual([]);
  });
  test('restart: done entries never repeat and long-overdue ones are dropped, not bunched', () => {
    const plan = [{ id: 'a', atMs: 0, sender: 'x', recipient: 'y' }, { id: 'b', atMs: 1000, sender: 'x', recipient: 'y' }, { id: 'c', atMs: NIGHT_LATE_MS + 5000, sender: 'x', recipient: 'y' }];
    const r = dueNight(plan, new Set(['b']), NIGHT_LATE_MS + 6000);
    expect(r.due.map(e => e.id)).toEqual(['c']);
    expect(r.dropped.map(e => e.id)).toEqual(['a']);
  });
  test('config checks', () => {
    const config = { accounts: bots, maxSendsPerAccountPerDay: 10, reserve: base.reserve, chainApi: base.chainApi, broadcast: base.broadcast, night };
    expect(validateNightRunnerConfig(config).night.start).toBe('23:00');
    expect(() => validateConfig({ ...base, night })).toThrow('now separate');
    expect(validateConfig({ ...base, night: { ...night, enabled: false } }).bots).toEqual(bots);
    expect(() => validateNightRunnerConfig({ accounts: bots, maxSendsPerAccountPerDay: 10, reserve: base.reserve, chainApi: base.chainApi, broadcast: base.broadcast, night: { ...night, senders: ['stranger'] } })).toThrow();
    expect(() => validateNightRunnerConfig({ accounts: bots, maxSendsPerAccountPerDay: 10, reserve: base.reserve, chainApi: base.chainApi, broadcast: base.broadcast, night: { ...night, timezone: 'Mars/Base' } })).toThrow();
    expect(() => validateNightRunnerConfig({ accounts: bots, maxSendsPerAccountPerDay: 10, reserve: base.reserve, chainApi: base.chainApi, broadcast: base.broadcast, night: { ...night, start: '25:00' } })).toThrow();
    expect(() => validateNightRunnerConfig({ accounts: bots, maxSendsPerAccountPerDay: 10, reserve: base.reserve, chainApi: base.chainApi, broadcast: base.broadcast, night: { ...night, sendsMin: 4, sendsMax: 2 } })).toThrow();
  });
});
