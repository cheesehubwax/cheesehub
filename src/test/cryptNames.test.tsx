import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { cryptDisplayName, loadCryptNames, parseCryptName, saveCryptName } from '@/lib/cryptNames';
import { generateKey, loadKey, parseKeyFile, saveContact, saveKey, toPublicFile } from '@/lib/cheeseCrypt';
import { AvatarEditor } from '@/components/crypt/AvatarEditor';
import { FriendNameDialog } from '@/components/crypt/FriendNameDialog';

beforeEach(() => { localStorage.clear(); });
describe('CHEESECrypt names', () => {
  it('shares an optional profile name without exposing secrets or changing legacy memos', () => {
    const original = generateKey('alice');
    const key = { ...original, displayName: 'Alice Cheese' };
    saveKey(key);
    expect(loadKey('alice')?.displayName).toBe('Alice Cheese');
    const shared = toPublicFile(key);
    expect(shared.displayName).toBe('Alice Cheese');
    expect(shared).not.toHaveProperty('secretKey');
    expect(parseKeyFile(shared)?.publicKey).toBe(original.publicKey);
    expect(parseKeyFile(original)?.displayName).toBeUndefined();
  });
  it('rejects malformed display metadata but keeps valid legacy keys readable', () => {
    const original = generateKey('alice');
    for (const displayName of [42, {}, 'x'.repeat(41), 'A\u202eB', 'A\nB']) {
      const parsed = parseKeyFile({ ...original, displayName });
      expect(parsed?.displayName).toBeUndefined();
      expect(parsed?.publicKey).toBe(original.publicKey);
    }
    expect(parseCryptName('  Alice 🧀  ')).toBe('Alice 🧀');
  });
  it('prioritizes a private nickname over shared name and account without changing contact keys', () => {
    const bob = generateKey('bob');
    saveContact('alice', 'bob', bob.publicKey, undefined, 'Bob Cheese');
    expect(cryptDisplayName('bob', loadCryptNames('alice'), {})).toBe('Bob Cheese');
    saveCryptName('alice', 'bob', 'Best friend', 'nicknames');
    expect(cryptDisplayName('bob', loadCryptNames('alice'), loadCryptNames('alice', 'nicknames'))).toBe('Best friend');
    saveContact('alice', 'bob', bob.publicKey, undefined, 'New Bob');
    expect(loadCryptNames('alice', 'nicknames').bob).toBe('Best friend');
    saveCryptName('alice', 'bob', '', 'nicknames');
    expect(cryptDisplayName('bob', loadCryptNames('alice'), loadCryptNames('alice', 'nicknames'))).toBe('New Bob');
    expect(cryptDisplayName('carol', {}, {})).toBe('carol');
    expect(loadCryptNames('other')).toEqual({});
  });
  it('saves profile metadata from the combined name/avatar editor', () => {
    const onSaveProfile = vi.fn();
    render(<AvatarEditor account="alice" onSave={vi.fn()} onSaveProfile={onSaveProfile} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('CHEESECrypt name'), { target: { value: 'Alice Cheese' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(onSaveProfile.mock.calls[0][1]).toBe('Alice Cheese');
    expect(onSaveProfile.mock.calls[0][0].pixels).toHaveLength(64);
  });
  it('lets a friend nickname be saved or cleared without altering their shared profile', () => {
    const onSave = vi.fn();
    render(<FriendNameDialog account="bob" sharedName="Bob Cheese" nickname="Best friend" onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save nickname' }));
    expect(onSave).toHaveBeenCalledWith('');
  });
});