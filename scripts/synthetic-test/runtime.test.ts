import { afterEach, expect, test } from 'bun:test';
import { submitOnce } from './runtime';
import { createRuntime, WAX_CHAIN_ID } from './runtime';
import { Serializer, Transaction, Signature } from '@wharfkit/antelope';
import { runtimeFixture } from './runtimeFixture';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createNightScheduler, readNightState, nightFingerprint, writeJsonAtomic, type NightState } from './nightState';
import { type NightConfig } from './policy';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test('signed write uses its exact endpoint/body once and verifies executed transaction ID', async () => {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (url, options) => {
    calls.push({ url: String(url), body: options?.body });
    return Response.json({ transaction_id: 'abc', processed: { receipt: { status: 'executed' } } });
  }) as typeof fetch;
  expect(await submitOnce('http://127.0.0.1:8088/v1/chain/send_transaction', 'exact-signed-bytes', 'abc')).toBe('abc');
  expect(calls).toEqual([{ url: 'http://127.0.0.1:8088/v1/chain/send_transaction', body: 'exact-signed-bytes' }]);
});
test('timeout is one attempt with no direct or alternate-endpoint retry', async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('timeout'); }) as typeof fetch;
  await expect(submitOnce('http://127.0.0.1:8088/v1/chain/send_transaction', 'signed', 'abc')).rejects.toThrow('timeout');
  expect(calls).toBe(1);
});
test('missing/mismatched IDs and non-executed receipts never report success', async () => {
  for (const response of [{}, { transaction_id: 'different', processed: { receipt: { status: 'executed' } } }, { transaction_id: 'abc', processed: { receipt: { status: 'soft_fail' } } }]) {
    globalThis.fetch = (async () => Response.json(response)) as typeof fetch;
    await expect(submitOnce('http://127.0.0.1:8088/v1/chain/send_transaction', 'signed', 'abc')).rejects.toThrow('not confirmed');
  }
});

test('full standalone scheduled flow checks permissions, signs, submits once and reads progress back after restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'night-flow-'));
  const fixture = runtimeFixture(true);
  const names = fixture.bots.map(b => b.account);
  const night: NightConfig = { enabled: true, timezone: 'Australia/Brisbane', start: '23:00', end: '06:30', sendsMin: 1, sendsMax: 1, skipNightChance: 0, replyChance: 0, replyDelayMinSeconds: 180, replyDelayMaxSeconds: 900, senders: [names[0]] };
  const now = Date.parse('2026-11-27T14:00:00Z');
  const path = join(dir, 'night-config.night.json');
  const counterPath = join(dir, 'night-config.state.json');
  const state: NightState = { fingerprint: nightFingerprint(night, names), key: '2026-11-27', plan: [{ id: '2026-11-27:0', atMs: now - 1000, sender: names[0], recipient: names[1] }], done: [] };
  let writes = 0;
  try {
    globalThis.fetch = (async (url, options) => {
      const target = String(url);
      const body = JSON.parse(String(options?.body ?? '{}')) as Record<string, string>;
      if (target.endsWith('/send_transaction')) {
        writes++;
        expect(target).toBe('http://127.0.0.1:8088/v1/chain/send_transaction');
        expect(JSON.parse(readFileSync(path, 'utf8')).done).toEqual(['2026-11-27:0']);
        expect(JSON.parse(readFileSync(counterPath, 'utf8')).sent['alpha.chz']).toBe(1);
        const tx = Serializer.decode({ data: body.packed_trx, type: Transaction });
        expect(tx.actions.length).toBe(1);
        expect(String(tx.actions[0].name)).toBe('sendfree');
        expect(String(tx.actions[0].authorization[0])).toBe('alpha.chz@cheesecrypt');
        const signatures = body.signatures as unknown as string[];
        expect(Signature.from(signatures[0]).recoverDigest(tx.signingDigest(WAX_CHAIN_ID)).equals(fixture.keys[0].toPublic())).toBe(true);
        return Response.json({ transaction_id: String(tx.id), processed: { receipt: { status: 'executed' } } });
      }
      // No history endpoint or daytime subscription is available to this flow.
      return Response.json(fixture.respond(target, body));
    }) as typeof fetch;
    const config = { bots: fixture.bots, chainApi: ['https://offline-chain.test'], broadcast: 'http://127.0.0.1:8088', reserve: '1.0000 CHEESE', maxSendsPerBotPerDay: 10 };
    const make = async () => {
      const runtime = createRuntime(config, counterPath, false);
      await runtime.preflight();
      return createNightScheduler({ night, accounts: names, state: readNightState(path, state.fingerprint, names, night), now: () => now, rand: () => 0.5, persist: s => writeJsonAtomic(path, s), send: (sender, recipient) => runtime.send(sender, 'offline night test', recipient) });
    };
    writeJsonAtomic(path, state);
    await (await make()).tick();
    await (await make()).tick();
    expect(writes).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('dry-run verifies and signs the paid route but never broadcasts or writes counters', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'night-dry-'));
  const fixture = runtimeFixture(false);
  const path = join(dir, 'night-config.state.json');
  let writes = 0;
  try {
    globalThis.fetch = (async (url, options) => {
      if (String(url).endsWith('/send_transaction')) { writes++; throw new Error('dry run must not broadcast'); }
      return Response.json(fixture.respond(String(url), JSON.parse(String(options?.body ?? '{}'))));
    }) as typeof fetch;
    const runtime = createRuntime({ bots: fixture.bots, chainApi: ['https://offline-chain.test'], broadcast: 'http://127.0.0.1:8088', reserve: '1.0000 CHEESE', maxSendsPerBotPerDay: 10 }, path, true);
    await runtime.preflight();
    await runtime.send('alpha.chz', 'offline dry-run', 'brie.chz');
    expect(writes).toBe(0); expect(existsSync(path)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('runtime with multiple read endpoints never retries an ambiguous signed submission', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'night-ambiguous-'));
  const fixture = runtimeFixture(true);
  let submissions = 0;
  const urls: string[] = [];
  try {
    globalThis.fetch = (async (url, options) => {
      const target = String(url); urls.push(target);
      if (target.endsWith('/send_transaction')) { submissions++; throw new Error('ambiguous broadcast timeout'); }
      return Response.json(fixture.respond(target, JSON.parse(String(options?.body ?? '{}'))));
    }) as typeof fetch;
    const runtime = createRuntime({ bots: fixture.bots, chainApi: ['https://offline-first.test', 'https://offline-second.test'], broadcast: 'http://127.0.0.1:8088', reserve: '1.0000 CHEESE', maxSendsPerBotPerDay: 10 }, join(dir, 'night-config.state.json'), false);
    await runtime.preflight();
    await expect(runtime.send('alpha.chz', 'offline uncertainty test', 'brie.chz')).rejects.toThrow('ambiguous broadcast');
    expect(submissions).toBe(1);
    expect(urls.some(url => url.startsWith('https://offline-second.test'))).toBe(false);
    expect(runtime.getState().sent['alpha.chz']).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});