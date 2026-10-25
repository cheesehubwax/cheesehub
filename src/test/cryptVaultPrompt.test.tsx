import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VaultPrompt } from '@/components/crypt/VaultPrompt';
import { LOCK_SCHEME, type LockedKeyFile } from '@/lib/cryptKeyLock';
import type { DirHandle } from '@/lib/cryptVault';

const vault = vi.hoisted(() => ({ pick: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/cryptVault', async (original) => ({
  ...await original<typeof import('@/lib/cryptVault')>(),
  vaultSupported: () => true,
  pickVault: vault.pick,
  writePrivateKey: vault.write,
}));

const key: LockedKeyFile = { type: 'gpk-msg-key', version: 2, account: 'alice', publicKey: 'p', created: '', lock: { scheme: LOCK_SCHEME, salt: '', nonce: '', ciphertext: '' } };
afterEach(() => vi.resetAllMocks());

describe('vault prompt permission recovery', () => {
  it.each(['SecurityError', 'NotAllowedError'])('keeps the backup unsaved and allows retry after %s', async (name) => {
    const root = { name: 'cheesecrypt' } as DirHandle;
    vault.pick.mockRejectedValueOnce(new DOMException('Access denied', name)).mockResolvedValueOnce(root);
    vault.write.mockResolvedValue(undefined);
    const saved = vi.fn();
    const download = vi.fn();
    render(<VaultPrompt cryptKey={key} onSaved={saved} onDownload={download} />);
    const choose = screen.getByRole('button', { name: 'Choose Desktop/cheesecrypt folder' });
    fireEvent.click(choose);
    await waitFor(() => expect(choose).toBeEnabled());
    expect(saved).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(vault.write).not.toHaveBeenCalled();
    fireEvent.click(choose);
    await waitFor(() => expect(saved).toHaveBeenCalledWith(root));
    expect(vault.write).toHaveBeenCalledWith(root, key);
  });
});