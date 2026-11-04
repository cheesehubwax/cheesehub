import { describe, expect, it } from 'vitest';
import { findMatches, searchableText } from '@/lib/cryptSearch';

const msgs = [
  { key: 'a', text: 'Hello CHEESE fans' },
  { key: 'b', text: 'nothing here' },
  { key: 'c', text: 'secret cheese', collapsed: true },
  { key: 'd', text: null },
  { key: 'e', text: 'look [nft:1100004009145]' },
];

describe('in-chat search', () => {
  it('matches case-insensitively in thread order', () => {
    expect(findMatches(msgs, 'cheese')).toEqual(['a']);
  });
  it('blank query matches nothing', () => {
    expect(findMatches(msgs, '   ')).toEqual([]);
  });
  it('collapsed messages match only once revealed', () => {
    expect(findMatches(msgs, 'secret')).toEqual([]);
    expect(findMatches(msgs, 'secret', new Set(['c']))).toEqual(['c']);
  });
  it('NFT ids are not searchable', () => {
    expect(findMatches(msgs, '1100004009145')).toEqual([]);
    expect(searchableText('look [nft:1]')).toBe('look');
  });
});
