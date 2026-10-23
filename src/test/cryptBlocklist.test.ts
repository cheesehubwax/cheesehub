import { beforeEach, describe, expect, it } from 'vitest';
import { addBlocked, loadBlocked, removeBlocked, saveBlocked, withoutBlocked } from '@/lib/cryptBlocklist';

describe('CHEESECrypt block list', () => {
  beforeEach(() => localStorage.clear());
  it('normalizes, dedupes and rejects invalid or own accounts', () => {
    expect(addBlocked(['bob'], ' BOB ')).toEqual(['bob']);
    expect(() => addBlocked([], 'not valid!')).toThrow();
    expect(() => addBlocked([], 'alice', 'alice')).toThrow("can't block your own");
    expect(removeBlocked(['bob', 'carol'], 'bob')).toEqual(['carol']);
  });
  it('stores per account on this device only', () => {
    saveBlocked('alice', ['bob']);
    expect(loadBlocked('alice')).toEqual(['bob']);
    expect(loadBlocked('dave')).toEqual([]);
  });
  it('drops memos with blocked accounts in both directions before decryption', () => {
    const memos = [
      { from: 'bob', to: 'alice', memo: 'x' }, { from: 'alice', to: 'bob', memo: 'y' },
      { from: 'carol', to: 'alice', memo: 'z' },
    ];
    expect(withoutBlocked(memos, 'alice', ['bob'])).toEqual([{ from: 'carol', to: 'alice', memo: 'z' }]);
    expect(withoutBlocked(memos, 'alice', [])).toHaveLength(3);
  });
});
