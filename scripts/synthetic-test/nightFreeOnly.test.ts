import { afterEach, expect, test } from 'bun:test';
import { checkPermission } from './policy';
import { createRuntime } from './runtime';
import { runtimeFixture } from './runtimeFixture';
import { Serializer, Transaction } from '@wharfkit/antelope';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const authority = (key: string) => ({ keys: [{ key }] });
const account = (links: { account: string; action?: string }[] | undefined) => ({ permissions: [
  { perm_name: 'active', required_auth: authority('HIGH') },
  { perm_name: 'cheesecrypt', required_auth: authority('NIGHT'), linked_actions: links },
] });
const freeLink = { account: 'crypt.cheese', action: 'sendfree' };

test('Nightcrawler needs exactly one sendfree link; daytime still needs three', () => {
  expect(checkPermission(account([freeLink]), 'cheesecrypt', ['NIGHT'], 'free-only')).toBeNull();
  expect(checkPermission(account([freeLink]), 'cheesecrypt', ['NIGHT'])).toContain('transfer');
  expect(checkPermission(account([]), 'cheesecrypt', ['NIGHT'], 'free-only')).toContain('sendfree');
});
test('Nightcrawler rejects transfer, sendmsg, wildcard and unverified links', () => {
  for (const extra of [{ account: 'cheeseburger', action: 'transfer' }, { account: 'crypt.cheese', action: 'sendmsg' }, { account: 'crypt.cheese' }]) {
    expect(checkPermission(account([freeLink, extra]), 'cheesecrypt', ['NIGHT'], 'free-only')).toContain('more than');
  }
  expect(checkPermission(account(undefined), 'cheesecrypt', ['NIGHT'], 'free-only')).toContain('cannot verify');
});
test('Nightcrawler refuses keys reused on another permission', () => {
  const a = account([freeLink]);
  a.permissions.push({ perm_name: 'other', required_auth: authority('NIGHT'), linked_actions: [{ account: 'cheeseburger', action: 'transfer' }] });
  expect(checkPermission(a, 'cheesecrypt', ['NIGHT'], 'free-only')).toContain('another permission');
  a.permissions[0].required_auth = authority('NIGHT');
  expect(checkPermission(a, 'cheesecrypt', ['NIGHT'], 'free-only')).toContain('active');
});

for (const scenario of ['sponsored', 'empty', 'budget-failure', 'low-cpu', 'unknown-cpu', 'broad-key', 'daily-cap'] as const) {
  test(`free-only runtime: ${scenario} never pays or powers up`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'night-free-'));
    const fixture = runtimeFixture(scenario !== 'empty', scenario !== 'broad-key');
    let writes = 0;
    let balanceReads = 0;
    const actions: string[] = [];
    try {
      globalThis.fetch = (async (url, options) => {
        const target = String(url);
        const body = JSON.parse(String(options?.body ?? '{}'));
        if (target.endsWith('/get_currency_balance')) { balanceReads++; throw new Error('no balance scan allowed'); }
        if (target.endsWith('/send_transaction')) {
          writes++;
          const tx = Serializer.decode({ data: body.packed_trx, type: Transaction });
          actions.push(...tx.actions.map(a => `${a.account}::${a.name}`));
          return Response.json({ transaction_id: String(tx.id), processed: { receipt: { status: 'executed' } } });
        }
        if (target.endsWith('/get_table_rows') && scenario === 'budget-failure') throw new Error('budget unavailable');
        if (target.endsWith('/get_account') && scenario === 'unknown-cpu' && body.account_name === 'alpha.chz' && checked) throw new Error('CPU unknown');
        const response = fixture.respond(target, body);
        if (target.endsWith('/get_account') && scenario === 'low-cpu' && 'cpu_limit' in response) response.cpu_limit.available = 0;
        return Response.json(response);
      }) as typeof fetch;
      let checked = false;
      const runtime = createRuntime({ bots: fixture.bots, sendMode: 'free-only', chainApi: ['https://offline.test'], broadcast: 'http://127.0.0.1:8088', reserve: '1.0000 CHEESE', maxSendsPerBotPerDay: 1 }, join(dir, 'state.json'), false);
      await expect(runtime.send('alpha.chz', 'before-preflight', 'brie.chz')).rejects.toThrow('preflight required');
      if (scenario === 'broad-key') {
        await expect(runtime.preflight()).rejects.toThrow('more than');
      } else {
        await runtime.preflight(); checked = true;
        await runtime.send('alpha.chz', 'night-test', 'brie.chz');
        if (scenario === 'daily-cap') await runtime.send('alpha.chz', 'second-entry', 'brie.chz');
      }
      expect(writes).toBe(scenario === 'sponsored' || scenario === 'daily-cap' ? 1 : 0);
      expect(actions).toEqual(writes ? ['crypt.cheese::sendfree'] : []);
      expect(balanceReads).toBe(0);
      expect(runtime.getState().powerups).toEqual({});
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}