import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { loadKey } from '@/lib/cheeseCrypt';
import { accountAvatar } from '@/lib/cryptAvatar';
import { Messenger } from '@/pages/CheeseCrypt';

vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: vi.fn() }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: async () => [] }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null, rememberVault: async () => {} }));
vi.mock('@/components/crypt/VaultPrompt', () => ({ VaultPrompt: ({ onSaved, onDownload }: { onSaved: (root: unknown) => void; onDownload: () => void }) => <div><button onClick={() => onSaved({})}>Save backup</button><button onClick={onDownload}>Download backup</button></div> }));

const props = { account: 'alice', session: { permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session };
beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
describe('post-backup profile setup', () => {
  it.each(['Save backup', 'Download backup'])('opens only after %s and keeps defaults when skipped', async action => {
    const view = render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    expect(screen.queryByLabelText('CHEESECrypt name')).not.toBeInTheDocument();
    const original = loadKey('alice');
    fireEvent.click(screen.getByRole('button', { name: action }));
    await screen.findByLabelText('CHEESECrypt name');
    fireEvent.click(screen.getByRole('button', { name: 'Use defaults' }));
    expect(loadKey('alice')).toEqual(original);
    expect(loadKey('alice')?.displayName).toBeUndefined();
    expect(loadKey('alice')?.avatar).toBeUndefined();
    view.unmount();
    render(<Messenger {...props} />);
    await waitFor(() => expect(screen.queryByLabelText('CHEESECrypt name')).not.toBeInTheDocument());
  });
  it('saves the chosen name and avatar without replacing encryption keys', async () => {
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
    const original = loadKey('alice');
    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }));
    fireEvent.change(await screen.findByLabelText('CHEESECrypt name'), { target: { value: 'Alice Cheese' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(loadKey('alice')?.displayName).toBe('Alice Cheese');
    expect(loadKey('alice')?.avatar).toEqual(accountAvatar('alice'));
    expect(loadKey('alice')?.publicKey).toBe(original?.publicKey);
    expect(loadKey('alice')?.secretKey).toBe(original?.secretKey);
  });
});