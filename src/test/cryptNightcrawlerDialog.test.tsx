import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/session';
import { CryptNightcrawler } from '@/components/crypt/CryptNightcrawler';

const io = vi.hoisted(() => ({ read: vi.fn(), endpoints: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/cryptChainRead', () => ({ cryptChainPost: io.read }));
vi.mock('@/lib/endpointHealth', async original => ({ ...await original<typeof import('@/lib/endpointHealth')>(), resolveEndpoints: io.endpoints }));
const keys = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
const authority = (key: string) => ({ threshold: 1, keys: [{ key, weight: 1 }], accounts: [], waits: [] });
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  io.endpoints.mockResolvedValue(['https://node.example']);
  io.read.mockImplementation(async (_: string, body: { account_name: string }) => ({ permissions: [{ perm_name: 'nightcrawler', parent: 'active', required_auth: authority(keys[body.account_name === 'alice' ? 0 : 1].toPublic().toString()), linked_actions: [{ account: 'crypt.cheese', action: 'sendfree' }] }] }));
  vi.stubGlobal('fetch', io.fetch.mockResolvedValue({ ok: true, text: async () => 'source' }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('prepares enabled configuration from user input, downloads it, and invalidates it after an edit', async () => {
  const execute = vi.fn();
  render(<CryptNightcrawler account="alice" canSetup={false} execute={execute} vault={null} />);
  fireEvent.change(screen.getByLabelText('Nightcrawler account 2'), { target: { value: 'bob' } });
  for (let i = 0; i < 2; i++) fireEvent.change(screen.getByLabelText(`Nightcrawler private key ${i + 1}`), { target: { value: keys[i].toString() } });
  fireEvent.click(screen.getByLabelText(/I own both accounts/));
  fireEvent.click(screen.getByLabelText('Enable in exported configuration'));
  fireEvent.click(screen.getByRole('button', { name: /Verify & prepare/ }));
  await screen.findByRole('button', { name: /Download night-config.json/ });
  let blob: Blob | undefined;
  vi.stubGlobal('URL', class extends URL { static createObjectURL(b: Blob) { blob = b; return 'blob:config'; } static revokeObjectURL() {} });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: /Download night-config.json/ }));
  const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); if (blob) reader.readAsText(blob); });
  const saved = JSON.parse(text);
  expect(saved.accounts.map((a: { account: string }) => a.account)).toEqual(['alice', 'bob']);
  expect(saved.night.enabled).toBe(true);
  expect(saved.accounts[0].privateKey).toBe(keys[0].toString());
  expect(execute).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  fireEvent.change(screen.getByLabelText('Nightcrawler end'), { target: { value: '07:00' } });
  expect(screen.queryByRole('button', { name: /Download night-config.json/ })).toBeNull();
});

it('requires confirmation before Anchor setup and retains a generated key after an uncertain result', async () => {
  io.read.mockResolvedValue({ permissions: [{ perm_name: 'active', parent: 'owner', required_auth: authority(keys[0].toPublic().toString()), linked_actions: [] }] });
  const execute = vi.fn().mockResolvedValue({ success: false, txId: null });
  render(<CryptNightcrawler account="alice" canSetup execute={execute} vault={null} />);
  fireEvent.click(screen.getByRole('button', { name: /Create sendfree-only/ }));
  expect(execute).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Confirm & open Anchor/ }));
  await waitFor(() => expect(execute).toHaveBeenCalledOnce());
  await screen.findByText(/Permission setup was not confirmed/);
  const keyInput = screen.getByLabelText('Nightcrawler private key 1') as HTMLInputElement;
  expect(PrivateKey.from(keyInput.value).toPublic().toString()).not.toBe(keys[0].toPublic().toString());
  expect(execute.mock.calls[0][0].map((a: { account: string; name: string }) => `${a.account}::${a.name}`)).toEqual(['eosio::updateauth', 'eosio::linkauth']);
  expect(screen.getByRole('button', { name: /Save generated signing key/ })).toBeEnabled();
});