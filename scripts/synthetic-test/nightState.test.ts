import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNightScheduler, nightFingerprint, readNightState, writeJsonAtomic, lockRunner, type NightState } from './nightState';
import { type NightConfig, validateNightRunnerConfig } from './policy';

const night: NightConfig = { enabled: true, timezone: 'Australia/Brisbane', start: '23:00', end: '06:30', sendsMin: 1, sendsMax: 1, skipNightChance: 0, replyChance: 0, replyDelayMinSeconds: 180, replyDelayMaxSeconds: 900, senders: ['alpha.chz'] };
const accounts = ['alpha.chz', 'brie.chz'];
const now = Date.parse('2026-11-27T14:00:00Z');
const initial = (): NightState => ({ fingerprint: nightFingerprint(night, accounts), key: '2026-11-27', plan: [{ id: '2026-11-27:0', atMs: now - 1000, sender: accounts[0], recipient: accounts[1] }], done: [] });

describe('standalone Nightcrawler progress', () => {
  test('live send reads its committed ID back from disk and restart never repeats it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nightcrawler-'));
    const path = join(dir, 'night-config.night.json');
    let sends = 0;
    try {
      writeJsonAtomic(path, initial());
      const make = () => createNightScheduler({ night, accounts, state: readNightState(path, nightFingerprint(night, accounts), accounts, night), now: () => now, rand: () => 0.5, persist: s => writeJsonAtomic(path, s), send: async (sender, recipient) => {
        expect(sender).toBe('alpha.chz'); expect(recipient).toBe('brie.chz');
        expect(JSON.parse(readFileSync(path, 'utf8')).done).toEqual(['2026-11-27:0']);
        sends++;
      } });
      await make().tick();
      await make().tick();
      expect(sends).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('disk write failure prevents signing or sending', async () => {
    let sends = 0;
    const scheduler = createNightScheduler({ night, accounts, state: initial(), now: () => now, rand: () => 0.5, persist: () => { throw new Error('disk full'); }, send: async () => { sends++; } });
    await expect(scheduler.tick()).rejects.toThrow('disk full');
    expect(sends).toBe(0);
  });
  test('uncertain send stays committed and is not retried', async () => {
    const state = initial();
    let attempts = 0;
    const scheduler = createNightScheduler({ night, accounts, state, now: () => now, rand: () => 0.5, persist: () => {}, send: async () => { attempts++; throw new Error('ambiguous'); } });
    await expect(scheduler.tick()).rejects.toThrow('ambiguous');
    await scheduler.tick();
    expect(attempts).toBe(1); expect(state.done).toEqual(['2026-11-27:0']);
  });
  test('disabled scheduling creates neither progress nor sends', async () => {
    let writes = 0, sends = 0;
    const scheduler = createNightScheduler({ night: { ...night, enabled: false }, accounts, state: null, now: () => now, rand: () => 0.5, persist: () => { writes++; }, send: async () => { sends++; } });
    await scheduler.tick();
    expect(writes).toBe(0); expect(sends).toBe(0);
  });
  test('outside the local window only plans ahead, never sends', async () => {
    let sends = 0;
    const scheduler = createNightScheduler({ night, accounts, state: null, now: () => Date.parse('2026-11-27T21:00:00Z'), rand: () => 0.5, persist: () => {}, send: async () => { sends++; } });
    await scheduler.tick();
    expect(sends).toBe(0); expect(scheduler.getState()?.key).toBe('2026-11-28');
  });
  test('clock rewind cannot recreate an earlier completed window', async () => {
    let sends = 0, writes = 0;
    const state = { ...initial(), key: '2026-11-28' };
    const scheduler = createNightScheduler({ night, accounts, state, now: () => now, rand: () => 0.5, persist: () => { writes++; }, send: async () => { sends++; } });
    await scheduler.tick();
    expect(writes).toBe(0); expect(sends).toBe(0); expect(scheduler.getState()?.key).toBe('2026-11-28');
  });
  test('overlapping ticks do not duplicate a pending send', async () => {
    let sends = 0;
    let release: (() => void) | undefined;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const scheduler = createNightScheduler({ night, accounts, state: initial(), now: () => now, rand: () => 0.5, persist: () => {}, send: async () => { sends++; await pending; } });
    const first = scheduler.tick();
    await scheduler.tick();
    release?.(); await first;
    expect(sends).toBe(1);
  });
  test('delays during a prior send drop later overdue entries rather than bunch them', async () => {
    let clock = now, sends = 0;
    const state = initial(); state.plan.push({ id: '2026-11-27:1', atMs: now - 500, sender: accounts[1], recipient: accounts[0] });
    const scheduler = createNightScheduler({ night, accounts, state, now: () => clock, rand: () => 0.5, persist: () => {}, send: async () => { sends++; clock += 11 * 60_000; } });
    await scheduler.tick();
    expect(sends).toBe(1); expect(state.done.length).toBe(2);
  });
  test('second process is refused and malformed progress is not reset', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nightcrawler-'));
    const path = join(dir, 'night-config.night.json');
    try {
      const release = lockRunner(path);
      expect(() => lockRunner(path)).toThrow(); release();
      const releaseAgain = lockRunner(path); releaseAgain();
      writeJsonAtomic(path, { ...initial(), done: ['not-in-plan'] });
      expect(() => readNightState(path, nightFingerprint(night, accounts), accounts, night)).toThrow('Invalid night progress');
      writeJsonAtomic(path, initial());
      expect(() => readNightState(path, 'changed-config', accounts, night)).toThrow('changed');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('standalone accounts and limits validate without any daytime configuration', () => {
    const config = { accounts: accounts.map(account => ({ account, permission: 'cheesecrypt', privateKey: 'PVT_K1_x' })), night, reserve: '1.0000 CHEESE', maxSendsPerAccountPerDay: 10, chainApi: ['https://wax.eosphere.io'], broadcast: 'http://127.0.0.1:8088' };
    expect(validateNightRunnerConfig(config).accounts.length).toBe(2);
    expect(() => validateNightRunnerConfig({ ...config, maxSendsPerAccountPerDay: 1.5 })).toThrow('whole number');
    expect(() => validateNightRunnerConfig({ ...config, accounts: [config.accounts[0]] })).toThrow();
  });
});