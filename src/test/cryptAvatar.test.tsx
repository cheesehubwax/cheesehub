import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { accountAvatar, parseAvatar, quantizeAvatar } from '@/lib/cryptAvatar';
import { generateKey, loadContactAvatars, loadContacts, parseKeyFile, saveContact, toPublicFile } from '@/lib/cheeseCrypt';
import { AvatarEditor } from '@/components/crypt/AvatarEditor';

describe('CHEESECrypt avatar data', () => {
  it('accepts exactly 64 palette pixels and rejects URLs and malformed data', () => {
    expect(parseAvatar({ version: 1, pixels: '3'.repeat(64) })?.pixels).toHaveLength(64);
    expect(parseAvatar({ version: 1, pixels: '3'.repeat(63) })).toBeUndefined();
    expect(parseAvatar({ version: 1, pixels: 'g'.repeat(64) })).toBeUndefined();
    expect(parseAvatar('https://example.com/avatar.svg')).toBeUndefined();
  });
  it('keeps private keys and public keys unchanged while sharing the optional avatar', () => {
    const original = generateKey('alice.wam');
    const key = { ...original, avatar: accountAvatar('alice.wam') };
    expect(parseKeyFile(JSON.parse(JSON.stringify(key)))).toEqual(key);
    expect(toPublicFile(key).avatar).toEqual(key.avatar);
    expect(toPublicFile(key)).not.toHaveProperty('secretKey');
    expect(parseKeyFile(original)?.publicKey).toBe(original.publicKey);
  });
  it('persists imported avatars separately without changing contact key strings', () => {
    localStorage.clear();
    const key = generateKey('bob.wam');
    const avatar = accountAvatar('bob.wam');
    saveContact('alice.wam', 'bob.wam', key.publicKey, avatar);
    expect(loadContacts('alice.wam')['bob.wam']).toBe(key.publicKey);
    expect(loadContactAvatars('alice.wam')['bob.wam']).toEqual(avatar);
    expect(loadContactAvatars('other.wam')).toEqual({});
  });
  it('generates repeatable, account-specific mirrored 8×8 defaults', () => {
    expect(accountAvatar('alice.wam')).toEqual(accountAvatar('alice.wam'));
    expect(accountAvatar('alice.wam')).not.toEqual(accountAvatar('bob.wam'));
    const pixels = accountAvatar('alice.wam').pixels;
    expect(pixels).toHaveLength(64);
    for (let y = 0; y < 8; y++) expect(pixels.slice(y * 8, y * 8 + 4)).toBe(pixels.slice(y * 8 + 4, y * 8 + 8).split('').reverse().join(''));
  });
  it('quantizes uploaded RGBA pixels and retains transparency', () => {
    const palette = Array.from({ length: 16 }, (_, i) => [i * 16, i * 16, i * 16]);
    const rgba = new Uint8ClampedArray(256);
    rgba.set([48, 48, 48, 255]);
    expect(quantizeAvatar(rgba, palette).pixels).toBe('3' + '0'.repeat(63));
  });
  it('saves a painted pixel without changing the other 63 pixels', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const onSave = vi.fn();
    render(<AvatarEditor account="alice.wam" avatar={{ version: 1, pixels: '0'.repeat(64) }} onSave={onSave} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Color 5$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Pixel 1$/ }), { detail: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
    expect(onSave).toHaveBeenCalledWith({ version: 1, pixels: '5' + '0'.repeat(63) });
    cleanup(); vi.unstubAllGlobals();
  });
});