import { act, fireEvent, render as renderUi, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, loadKey, saveKey, toPublicFile } from '@/lib/cheeseCrypt';
import { accountAvatar } from '@/lib/cryptAvatar';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ update: vi.fn(), recall: vi.fn(), writable: vi.fn(), transact: vi.fn(), backup: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: async () => [] }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: calls.recall, vaultWritable: calls.writable, updatePrivateKeyProfile: calls.update, rememberVault: async () => {} }));
vi.mock('@/components/crypt/VaultPrompt', () => ({ VaultPrompt: ({ cryptKey, onSaved, onDownload }: { cryptKey: unknown; onSaved: (root: unknown) => void; onDownload: () => void }) => <div><button onClick={() => { calls.backup(cryptKey); onSaved({}); }}>Save backup</button><button onClick={() => { calls.backup(cryptKey); onDownload(); }}>Download backup</button></div> }));

const props = { account: 'alice', session: { permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session };
const render = (ui: React.ReactElement) => renderUi(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  calls.recall.mockResolvedValue(null); calls.writable.mockResolvedValue(true); calls.update.mockResolvedValue(undefined);
  calls.transact.mockResolvedValue({ success: false });
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
async function payCreation() {
  expect(loadKey('alice')).toBeNull();
  const pay = await screen.findByRole('button', { name: 'Pay 100 CHEESE & create key' });
  expect(pay).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  calls.transact.mockResolvedValueOnce({ success: true, txId: 'confirmed-create-tx' });
  await act(async () => { fireEvent.click(pay); });
}
describe('profile-first key setup', () => {
  it('menu publishing requires fresh consent, keeps rejected requests open and sends only the public key with the 80/20 fee', async () => {
    const key = generateKey('alice'); saveKey(key);
    render(<Messenger {...props} />);
    const openPublish = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Publish my key on chain (0.0100 CHEESE)' }));
      return within(await screen.findByRole('dialog'));
    };
    let dialog = await openPublish();
    expect(calls.transact).not.toHaveBeenCalled();
    expect(dialog.getByRole('button', { name: 'Publish my key on chain' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    dialog = await openPublish();
    expect(dialog.getByRole('checkbox')).not.toBeChecked();
    expect(dialog.getByRole('button', { name: 'Publish my key on chain' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox'));
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Publish my key on chain' })); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(calls.transact).toHaveBeenCalledTimes(1);
    expect(calls.transact.mock.calls[0][0].map((a: { data: unknown }) => a.data)).toEqual([
      { from: 'alice', to: 'eosio.null', quantity: '0.0080 CHEESE', memo: `CRYPTKEY1:${key.publicKey}` },
      { from: 'alice', to: 'xcheeseliqst', quantity: '0.0020 CHEESE', memo: `CRYPTKEY1:${key.publicKey}` },
    ]);
    expect(localStorage.getItem('cheesecrypt-public-inbox-alice')).not.toBe('true');
    calls.transact.mockResolvedValueOnce({ success: true, txId: 'confirmed-publish' });
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Publish my key on chain' })); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it.each(['Save backup', 'Download backup'])('creates default-profile keys before %s, then offers sharing without repeating setup', async action => {
    const view = render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    expect(loadKey('alice')).toBeNull();
    expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument();
    await screen.findByLabelText('CHEESECrypt name');
    fireEvent.click(screen.getByRole('button', { name: 'Use defaults' }));
    await payCreation();
    const original = loadKey('alice');
    expect(original?.avatar).toEqual(accountAvatar('alice'));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(calls.backup).toHaveBeenCalledWith(original);
    expect(await screen.findByText('📣 Share your public key')).toBeInTheDocument();
    expect(loadKey('alice')?.displayName).toBeUndefined();
    if (!original) throw new Error('Key not created');
    expect(toPublicFile(original).avatar).toEqual(accountAvatar('alice'));
    view.unmount();
    render(<Messenger {...props} />);
    await waitFor(() => expect(screen.queryByLabelText('CHEESECrypt name')).not.toBeInTheDocument());
  });
  it('includes the chosen profile in the first private backup and public file', async () => {
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    expect(loadKey('alice')).toBeNull();
    fireEvent.change(await screen.findByLabelText('CHEESECrypt name'), { target: { value: 'Alice Cheese' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save profile' })); });
    await payCreation();
    const created = loadKey('alice');
    expect(created?.displayName).toBe('Alice Cheese');
    expect(created?.avatar).toEqual(accountAvatar('alice'));
    expect(screen.queryByText('📣 Share your public key')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }));
    expect(calls.backup).toHaveBeenCalledWith(created);
    if (!created) throw new Error('Key not created');
    expect(toPublicFile(created)).toMatchObject({ avatar: created.avatar, displayName: 'Alice Cheese', publicKey: created.publicKey });
    expect(toPublicFile(created)).not.toHaveProperty('secretKey');
  });
  it.each([
    ['Save profile', 'Alice Cheese'],
    ['Use defaults', null],
  ])('opens the share-key prompt after profile setup via %s', async (action, name) => {
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    if (name) fireEvent.change(await screen.findByLabelText('CHEESECrypt name'), { target: { value: name } });
    else await screen.findByLabelText('CHEESECrypt name');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: action })); });
    await payCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }));
    expect(await screen.findByText('📣 Share your public key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save public key file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish my key on chain' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
    await waitFor(() => expect(screen.queryByText('📣 Share your public key')).not.toBeInTheDocument());
  });
  it.each([{ success: false, txId: null }, { success: true, txId: null }])('does not create a key after failed or unverified payment: %o', async result => {
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use defaults' }));
    fireEvent.click(screen.getByRole('checkbox'));
    calls.transact.mockResolvedValueOnce(result);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay 100 CHEESE & create key' })); });
    expect(loadKey('alice')).toBeNull();
    expect(calls.transact.mock.calls[0][0].map((a: { data: unknown }) => a.data)).toEqual([
      { from: 'alice', to: 'eosio.null', quantity: '80.0000 CHEESE', memo: 'CHEESECrypt key creation fee' },
      { from: 'alice', to: 'xcheeseliqst', quantity: '20.0000 CHEESE', memo: 'CHEESECrypt key creation fee' },
    ]);
  });
  it('loads an existing private key for free', async () => {
    const existing = generateKey('alice');
    const { container } = render(<Messenger {...props} />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error('Missing import');
    const file = new File([], 'key.json');
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(existing) });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    expect(loadKey('alice')).toEqual(existing);
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it('preserves the selected profile after wallet rejection and permits retry without double payment', async () => {
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    fireEvent.change(await screen.findByLabelText('CHEESECrypt name'), { target: { value: 'Alice Cheese' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    fireEvent.click(screen.getByRole('checkbox'));
    calls.transact.mockRejectedValueOnce(new Error('Wallet rejected'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay 100 CHEESE & create key' })); });
    expect(loadKey('alice')).toBeNull();
    let confirmPayment: ((value: { success: boolean; txId: string }) => void) | undefined;
    calls.transact.mockImplementationOnce(() => new Promise(resolve => { confirmPayment = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Pay 100 CHEESE & create key' }));
    expect(screen.getByRole('button', { name: 'Confirming payment…' })).toBeDisabled();
    expect(calls.transact).toHaveBeenCalledTimes(2);
    await act(async () => { confirmPayment?.({ success: true, txId: 'confirmed' }); });
    expect(loadKey('alice')?.displayName).toBe('Alice Cheese');
    expect(calls.transact).toHaveBeenCalledTimes(2);
  });
  it('cancels creation without charging or generating a key', async () => {
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use defaults' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(loadKey('alice')).toBeNull();
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it.each(['success', 'failure', 'denied', 'no folder'])('keeps the same encryption keys and refreshes or downloads a backup after edits: %s', async outcome => {
    const original = generateKey('alice'); saveKey(original);
    const root = { name: 'cheesecrypt' };
    calls.recall.mockResolvedValue(outcome === 'no folder' ? null : root);
    if (outcome === 'failure') calls.update.mockRejectedValue(new Error('Mismatched backup'));
    if (outcome === 'denied') calls.writable.mockResolvedValue(false);
    render(<Messenger {...props} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    fireEvent.change(await screen.findByLabelText('CHEESECrypt name'), { target: { value: 'Updated Alice' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save profile' })); });
    const updated = loadKey('alice');
    expect(updated).toMatchObject({ publicKey: original.publicKey, secretKey: original.secretKey, displayName: 'Updated Alice', avatar: accountAvatar('alice') });
    expect(screen.queryByLabelText('CHEESECrypt name')).not.toBeInTheDocument();
    if (outcome === 'success' || outcome === 'failure') expect(calls.update).toHaveBeenCalledWith(root, updated);
    else expect(calls.update).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1);
  });
  it('requires terms and stays open after an unsuccessful publish', async () => {
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use defaults' }));
    await payCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }));
    const publish = screen.getByRole('button', { name: 'Publish my key on chain' });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(publish);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('📣 Share your public key')).toBeInTheDocument();
  });
});