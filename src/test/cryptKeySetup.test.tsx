import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CryptKeySetup } from '@/components/crypt/CryptKeySetup';

vi.mock('@/lib/cryptVault', async (original) => ({
  ...await original<typeof import('@/lib/cryptVault')>(),
  vaultSupported: () => true,
}));

const props = {
  account: 'alice', fileInput: null, profileEditor: null, creationDialog: null,
  fileRef: { current: null }, searchingVault: false, makeKey: vi.fn(),
};

describe('key setup folder actions', () => {
  it('offers to unlock the saved folder when one is remembered', () => {
    const open = vi.fn(); const pick = vi.fn();
    render(<CryptKeySetup {...props} hasSavedVault openSavedFolder={open} pickFolder={pick} />);
    fireEvent.click(screen.getByRole('button', { name: /unlock my saved cheesecrypt folder/i }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(pick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /choose another folder/i }));
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('offers to open the folder when none is remembered yet', () => {
    // The page falls back to the folder picker inside openSavedFolder when nothing is remembered.
    const open = vi.fn(); const pick = vi.fn();
    render(<CryptKeySetup {...props} hasSavedVault={false} openSavedFolder={open} pickFolder={pick} />);
    fireEvent.click(screen.getByRole('button', { name: /open my cheesecrypt folder/i }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(pick).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /choose another folder/i })).toBeNull();
  });

  it('still loads a key file directly', () => {
    const fileRef = { current: { click: vi.fn() } as unknown as HTMLInputElement };
    render(<CryptKeySetup {...props} fileRef={fileRef} hasSavedVault={false} openSavedFolder={vi.fn()} pickFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /load my private key file/i }));
    expect(fileRef.current.click).toHaveBeenCalledTimes(1);
  });
});
