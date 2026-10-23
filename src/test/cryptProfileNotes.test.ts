import { describe, expect, it } from 'vitest';
import { decryptMemoBytes, bytesToText, generateKey } from '@/lib/cheeseCrypt';
import { buildProfileNoteBatches, latestProfiles, parseProfileNote, profileNoteCost, profileNotePayload, profileNoteParts, profileRecipients, PROFILE_RECIPIENTS_PER_TX } from '@/lib/cryptProfileNotes';

const avatar = { version: 1 as const, pixels: '1'.repeat(64) };
type Act = { account: string; data: { from: string; to: string; quantity: string; memo: string } };

describe('CHEESECrypt profile notes', () => {
  it('round-trips name and avatar and rejects bad notes', () => {
    expect(parseProfileNote(profileNotePayload({ avatar, displayName: 'Alice' }))).toEqual({ displayName: 'Alice', avatar });
    expect(parseProfileNote(profileNotePayload({ avatar }))).toEqual({ avatar });
    expect(parseProfileNote('\u0002CP1:{"avatar":{"version":1,"pixels":"zz"}}')).toBeNull();
    expect(parseProfileNote('hello')).toBeNull();
  });
  it('newest complete note per sender wins; own and incomplete notes ignored', () => {
    const a = profileNotePayload({ avatar, displayName: 'Old' }), b = profileNotePayload({ avatar, displayName: 'New' });
    const out = latestProfiles([
      { from: 'bob', time: 2, text: b, missing: 0 }, { from: 'bob', time: 1, text: a, missing: 0 },
      { from: 'bob', time: 3, text: a, missing: 1 }, { from: 'alice', time: 9, text: a, missing: 0 },
    ], 'alice');
    expect(out).toEqual({ bob: { displayName: 'New', avatar, time: 2 } });
  });
  it('sends to friends and group members with keys, excluding self, blocked and removed', () => {
    expect(profileRecipients('alice', { bob: 'k', carol: 'k', dave: 'k' }, [['alice', 'carol', 'erin']], ['dave'])).toEqual(['bob', 'carol']);
  });
  it('charges one shared 80/20 platform fee per part plus 0.0010 CHEESE per recipient per part', () => {
    const alice = { ...generateKey('alice'), avatar, displayName: 'Alice' };
    const bob = generateKey('bob'), carol = generateKey('carol');
    const parts = profileNoteParts(alice);
    const [batch] = buildProfileNoteBatches(alice, ['bob', 'carol'], { bob: bob.publicKey, carol: carol.publicKey }, []) as Act[][];
    const to = (who: string) => batch.filter(a => a.data.to === who);
    expect(to('eosio.null').map(a => a.data.quantity)).toEqual(Array(parts).fill('0.0080 CHEESE'));
    expect(to('xcheeseliqst').map(a => a.data.quantity)).toEqual(Array(parts).fill('0.0020 CHEESE'));
    expect(to('bob').map(a => a.data.quantity)).toEqual(Array(parts).fill('0.0010 CHEESE'));
    expect(to('carol')).toHaveLength(parts);
    expect(profileNoteCost(parts, 2)).toBe(`${((100 + 10 * 2) * parts / 10000).toFixed(4)} CHEESE`);
    const bytes = decryptMemoBytes(to('bob')[0].data.memo, alice.publicKey, bob.secretKey);
    expect(bytes && bytesToText(bytes)).toBeTruthy();
  });
  it('splits large recipient lists into batches with the fee only in the first', () => {
    const alice = { ...generateKey('alice'), avatar };
    const people = Array.from({ length: PROFILE_RECIPIENTS_PER_TX + 1 }, (_, i) => `user${'abcdefghijklmnopqrstuvwxyz'[i]}`);
    const contacts = Object.fromEntries(people.map(p => [p, generateKey(p).publicKey]));
    const batches = buildProfileNoteBatches(alice, people, contacts, []) as Act[][];
    expect(batches).toHaveLength(2);
    expect(batches[1].some(a => a.data.to === 'eosio.null' || a.data.to === 'xcheeseliqst')).toBe(false);
  });
});
