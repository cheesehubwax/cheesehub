import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivateKey } from '@wharfkit/session';
import { buildNightDownload, nightSetupActions, saveNightFolder, verifyNightAccount, type NightChainAccount, type NightAccount } from '@/lib/cryptNightcrawler';
import { validateNightRunnerConfig } from '../../scripts/synthetic-test/policy';
import type { DirHandle } from '@/lib/cryptVault';

const io = vi.hoisted(() => ({ read: vi.fn(), endpoints: vi.fn() }));
vi.mock('@/lib/cryptChainRead', () => ({ cryptChainPost: io.read }));
vi.mock('@/lib/endpointHealth', async original => ({ ...await original<typeof import('@/lib/endpointHealth')>(), resolveEndpoints: io.endpoints }));
const keys = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
const high = PrivateKey.generate('K1');
const rows: NightAccount[] = ['alice', 'bob'].map((account, i) => ({ account, permission: 'nightcrawler', privateKey: keys[i].toString() }));
const authority = (key: PrivateKey) => ({ threshold: 1, keys: [{ key: key.toPublic().toString(), weight: 1 }], accounts: [], waits: [] });
const raw = (key: PrivateKey, linked = true): NightChainAccount => ({ permissions: [
  { perm_name: 'owner', parent: '', required_auth: authority(high), linked_actions: [] },
  { perm_name: 'active', parent: 'owner', required_auth: authority(high), linked_actions: [] },
  ...(linked ? [{ perm_name: 'nightcrawler', parent: 'active', required_auth: authority(key), linked_actions: [{ account: 'crypt.cheese', action: 'sendfree' }] }] : []),
] });
const settings = { timezone: 'Australia/Brisbane', start: '23:00', end: '06:30', sendsMin: 1, sendsMax: 3, enabled: false, replies: true };
beforeEach(() => { vi.clearAllMocks(); io.endpoints.mockResolvedValue(['https://node.example']); io.read.mockImplementation(async (_: string, body: { account_name: string }) => raw(keys[body.account_name === 'alice' ? 0 : 1])); });

describe('Nightcrawler setup safeguards', () => {
  it('exports a runner-valid config after verifying both single sendfree permissions without sending private keys', async () => {
    const c = await buildNightDownload(rows, settings);
    expect(validateNightRunnerConfig(c)).toBe(c);
    expect(c.night.enabled).toBe(false);
    expect(c.night.senders).toEqual(['alice']);
    expect(c.night.sendsMin).toBe(1); expect(c.night.sendsMax).toBe(3);
    expect(c.broadcast).toBe('http://127.0.0.1:8088');
    expect(io.endpoints).toHaveBeenCalledWith('chain-api');
    expect(io.read.mock.calls).toEqual([
      ['/v1/chain/get_account', { account_name: 'alice' }], ['/v1/chain/get_account', { account_name: 'bob' }],
    ]);
  });
  it('requires only crypt.cheese::sendfree and refuses CHEESE transfer authority', () => {
    const r = raw(keys[0]); expect(() => verifyNightAccount(r, rows[0])).not.toThrow();
    r.permissions[2].linked_actions?.push({ account: 'cheeseburger', action: 'transfer' });
    expect(() => verifyNightAccount(r, rows[0])).toThrow(/linked to more/);
  });
  it('refuses owner/active keys even when also present on the restricted permission', () => {
    const r = raw(keys[0]); r.permissions[1].required_auth = authority(keys[0]);
    expect(() => verifyNightAccount(r, rows[0])).toThrow(/also on active/);
  });
  it('refuses unknown links and delegated or child authorities', () => {
    const unknown = raw(keys[0]); delete unknown.permissions[2].linked_actions;
    expect(() => verifyNightAccount(unknown, rows[0])).toThrow(/cannot verify/);
    const delegated = raw(keys[0]); delegated.permissions[2].required_auth.accounts = [{}];
    expect(() => verifyNightAccount(delegated, rows[0])).toThrow(/delegated/);
    const child = raw(keys[0]); child.permissions.push({ perm_name: 'child', parent: 'nightcrawler', required_auth: authority(high), linked_actions: [] });
    expect(() => verifyNightAccount(child, rows[0])).toThrow(/children/);
  });
  it('creates only updateauth plus sendfree linkauth with no token actions', () => {
    const actions = nightSetupActions(raw(keys[0], false), 'alice', 'nightcrawler', keys[0].toPublic().toString());
    expect(actions.map(a => `${a.account}::${a.name}`)).toEqual(['eosio::updateauth', 'eosio::linkauth']);
    expect(actions[1].data).toEqual({ account: 'alice', code: 'crypt.cheese', type: 'sendfree', requirement: 'nightcrawler' });
  });
  it('never replaces an existing permission or Instant Messaging link', () => {
    expect(() => nightSetupActions(raw(keys[0]), 'alice', 'nightcrawler', keys[1].toPublic().toString())).toThrow(/already exists/);
    expect(() => nightSetupActions(raw(keys[0]), 'alice', 'other', keys[1].toPublic().toString())).toThrow(/already linked/);
  });
  it('does not prepare downloads when an account read fails', async () => {
    io.read.mockRejectedValue(new Error('Tor helper not reachable'));
    await expect(buildNightDownload(rows, settings)).rejects.toThrow('Tor helper not reachable');
  });
  it('never echoes malformed private keys in validation errors', async () => {
    const bad = 'private-sensitive-invalid-test';
    try { await buildNightDownload([{ ...rows[0], privateKey: bad }, rows[1]], settings); throw new Error('should reject'); }
    catch (e) { expect(String(e)).toContain('Invalid restricted private key'); expect(String(e)).not.toContain(bad); }
    expect(io.read).not.toHaveBeenCalled();
  });
  it('saves to cheesecrypt/nightcrawler and never replaces existing configuration or progress', async () => {
    const c = await buildNightDownload(rows, settings);
    const saved = new Map<string, string>();
    const child: DirHandle = { name: 'nightcrawler', getDirectoryHandle: vi.fn(), getFileHandle: vi.fn(async (name, opts) => {
      if (!opts?.create && !saved.has(name)) throw new DOMException('', 'NotFoundError');
      return { createWritable: async () => ({ write: async (data: string) => { saved.set(name, data); }, close: async () => {} }) };
    }) };
    const root: DirHandle = { name: 'cheesecrypt', getDirectoryHandle: vi.fn(async () => child), getFileHandle: vi.fn() };
    await saveNightFolder(root, { 'night.ts': 'source' }, c);
    expect(root.getDirectoryHandle).toHaveBeenCalledWith('nightcrawler', { create: true });
    expect(JSON.parse(saved.get('night-config.json') ?? '{}').accounts.map((a: NightAccount) => a.account)).toEqual(['alice', 'bob']);
    await expect(saveNightFolder(root, { 'night.ts': 'changed' }, c)).rejects.toThrow(/already exist/);
    expect(saved.get('night.ts')).toBe('source');
    saved.clear(); saved.set('night-config.night.json', 'keep');
    await expect(saveNightFolder(root, { 'night.ts': 'source' }, c)).rejects.toThrow(/already exist/);
    expect([...saved.keys()]).toEqual(['night-config.night.json']);
  });
});