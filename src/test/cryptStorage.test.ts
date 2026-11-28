import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCryptLookupCache, cryptStorage, getCryptStorageIssue } from '@/lib/cryptStorage';
import { loadBlocked, saveBlocked } from '@/lib/cryptBlocklist';
import { loadCryptNames, saveCryptName } from '@/lib/cryptNames';
import { loadDecisions, saveDecision } from '@/lib/cryptInviteGroups';
import { loadModerationMemos, saveModerationMemos } from '@/lib/cryptModeration';
import { loadRoomProfiles, saveRoomProfiles } from '@/lib/cryptRoomProfiles';
import { loadPublicInbox, savePublicInbox } from '@/lib/cryptPublicInbox';
import { cryptDiagnostic } from '@/lib/cryptDiagnostics';

beforeEach(() => { clearCryptLookupCache(); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); clearCryptLookupCache(); localStorage.clear(); });
const quota = () => new DOMException('Secret exception content', 'QuotaExceededError');
function full() { vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota(); }); }

describe('Crypt storage quota protections', () => {
  it('keeps the newest failed write instead of rereading an older disk value', () => {
    localStorage.setItem('cheesecrypt-names-alice', '{"bob":"Old"}');
    full();
    saveCryptName('alice', 'bob', 'New');
    saveCryptName('alice', 'carol', 'Carol');
    expect(loadCryptNames('alice')).toEqual({ bob: 'New', carol: 'Carol' });
    expect(getCryptStorageIssue()).toBe('quota');
    expect(localStorage.getItem('cheesecrypt-names-alice')).toBe('{"bob":"Old"}');
  });
  it('keeps blocking active when storage is full', () => {
    full();
    expect(() => saveBlocked('alice', ['bob'])).not.toThrow();
    expect(loadBlocked('alice')).toEqual(['bob']);
    expect(loadBlocked('carol')).toEqual([]);
  });
  it('keeps leave consent through subsequent reloads of device state in this tab', () => {
    full();
    saveDecision('alice', '0123456789abcdef', 'left', 1234);
    expect(loadDecisions('alice')).toEqual({ '0123456789abcdef': { status: 'left', at: 1234 } });
  });
  it('retains encrypted controls without losing prior copies on another failed write', () => {
    const first = { txId: 'first', from: 'bob', to: 'alice', time: 123, quantity: '0.0001 CHEESE', memo: 'CRYPT2:ciphertext' };
    full();
    saveModerationMemos('alice', [first]);
    saveModerationMemos('alice', [...loadModerationMemos('alice'), { ...first, txId: 'second' }]);
    expect(loadModerationMemos('alice').map(row => row.txId)).toEqual(['first', 'second']);
  });
  it('retains validated room profiles while storage is full', () => {
    full();
    saveRoomProfiles('alice', { bob: { displayName: 'Bob', time: 123, self: true } });
    expect(loadRoomProfiles('alice')).toEqual({ bob: { displayName: 'Bob', time: 123, self: true } });
  });
  it('handles blocked storage access and preserves new settings in this tab', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(loadPublicInbox('alice')).toBe(false);
    expect(() => savePublicInbox('alice', true)).not.toThrow();
    expect(loadPublicInbox('alice')).toBe(true);
    expect(getCryptStorageIssue()).toBe('unavailable');
  });
  it('keeps failed removals hidden in this tab instead of resurrecting the disk value', () => {
    localStorage.setItem('cheesecrypt-keylock-alice', 'sealed');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(() => cryptStorage.removeItem('cheesecrypt-keylock-alice')).not.toThrow();
    expect(cryptStorage.getItem('cheesecrypt-keylock-alice')).toBeNull();
  });
  it('clears only reconstructible lookups and retries pending changes', () => {
    const protectedKeys = ['cheesecrypt-keylock-alice', 'cheesecrypt-key-alice', 'cheesecrypt-contacts-alice',
      'cheesecrypt-invite-decisions-alice', 'cheesecrypt-room-controls-alice', 'cheesecrypt-blocked-alice',
      'cheesecrypt-read-alice', 'cheesecrypt-privacy-gate', 'cheesecrypt-custom-hyperion',
      'cheesecrypt-room-hides-v1', 'cheesecrypt-trust-permanent-v1', 'crypt-sfx-played-v1', 'unrelated-app'];
    for (const key of protectedKeys) localStorage.setItem(key, 'keep');
    localStorage.setItem('cheesecrypt-trust-snapshot-v1', 'disposable');
    full();
    cryptStorage.setItem('cheesecrypt-names-alice', '{"bob":"New"}');
    vi.restoreAllMocks();
    expect(clearCryptLookupCache()).toBe(true);
    for (const key of protectedKeys) expect(localStorage.getItem(key)).toBe('keep');
    expect(localStorage.getItem('cheesecrypt-trust-snapshot-v1')).toBeNull();
    expect(localStorage.getItem('cheesecrypt-names-alice')).toBe('{"bob":"New"}');
    expect(getCryptStorageIssue()).toBeNull();
  });
  it('reports unsuccessful recovery without losing pending changes', () => {
    full();
    cryptStorage.setItem('cheesecrypt-names-alice', 'pending');
    expect(clearCryptLookupCache()).toBe(false);
    expect(cryptStorage.getItem('cheesecrypt-names-alice')).toBe('pending');
    expect(getCryptStorageIssue()).toBe('quota');
  });
  it('diagnoses both quota names without exposing the exception content', () => {
    for (const name of ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']) {
      const diagnostic = cryptDiagnostic(new DOMException('Secret exception content', name));
      expect(diagnostic.storageQuota).toBe(true);
      expect(diagnostic.stack).not.toContain('Secret exception content');
    }
  });
});