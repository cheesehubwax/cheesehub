import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
describe('profile-first key setup', () => {
  it.each(['Save backup', 'Download backup'])('creates default-profile keys before %s, then offers sharing without repeating setup', async action => {
    const view = render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    expect(loadKey('alice')).toBeNull();
    expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument();
    await screen.findByLabelText('CHEESECrypt name');
    fireEvent.click(screen.getByRole('button', { name: 'Use defaults' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }));
    expect(await screen.findByText('📣 Share your public key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save public key file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish my key on chain' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
    await waitFor(() => expect(screen.queryByText('📣 Share your public key')).not.toBeInTheDocument());
  });
  it.each(['success', 'failure', 'denied', 'no folder'])('keeps the same encryption keys and refreshes or downloads a backup after edits: %s', async outcome => {
    const original = generateKey('alice'); saveKey(original);
    const root = { name: 'cheesecrypt' };
    calls.recall.mockResolvedValue(outcome === 'no folder' ? null : root);
    if (outcome === 'failure') calls.update.mockRejectedValue(new Error('Mismatched backup'));
    if (outcome === 'denied') calls.writable.mockResolvedValue(false);
    render(<Messenger {...props} />);
    await act(async () => {});
    fireEvent.keyDown(screen.getByRole('button', { name: /Your key/ }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: '🎨 Edit profile' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }));
    const publish = screen.getByRole('button', { name: 'Publish my key on chain' });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(publish);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('📣 Share your public key')).toBeInTheDocument();
  });
});