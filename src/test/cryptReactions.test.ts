import { describe, expect, it } from 'vitest';
import { activeReactions, encodeReaction, isReaction, parseReaction, reactionPills, reactionsToMe, targetRef } from '@/lib/cryptReactions';
import { pendingReactionTargets } from '@/hooks/useCryptReactionNavigation';

const row = (key: string, from: string, time: number, text: string) => ({ key, from, time, text, missing: 0 });
const r = (key: string, from: string, time: number, add: boolean, author: string, at: number, emoji: '👍' | '🧀' = '👍') =>
  row(key, from, time, encodeReaction({ add, author, time: at, emoji }));

describe('reactions', () => {
  it('round-trips and rejects off-palette emoji', () => {
    const t = encodeReaction({ add: true, author: 'alice', time: 1234, emoji: '🧀' });
    expect(isReaction(t)).toBe(true);
    expect(parseReaction(t)).toEqual({ add: true, author: 'alice', time: 1234, emoji: '🧀' });
    expect(parseReaction('\u0006R1:+:alice:ya:💩')).toBeNull();
  });
  it('newest add/remove per reactor wins and counts aggregate', () => {
    const targets = new Set([targetRef('alice', 100)]);
    const rows = [r('1', 'bob', 200, true, 'alice', 100), r('2', 'carol', 210, true, 'alice', 100), r('3', 'bob', 220, false, 'alice', 100), r('4', 'dave', 230, true, 'zed', 5)];
    const active = activeReactions(rows, targets);
    expect(active.map(a => a.from)).toEqual(['carol']);
    expect(reactionPills(active, 'carol').get('alice:100')).toEqual([{ emoji: '👍', count: 1, mine: true, from: ['carol'] }]);
  });
  it('only others reacting to my messages alert me', () => {
    const active = activeReactions([r('1', 'alice', 200, true, 'alice', 100), r('2', 'bob', 210, true, 'alice', 100)], new Set(['alice:100']));
    expect(reactionsToMe(active, 'alice').map(a => a.key)).toEqual(['2']);
  });
  it('reaction alerts count per message and clear independently of replies', () => {
    const active = activeReactions([r('1', 'bob', 200, true, 'alice', 100), r('2', 'carol', 210, true, 'alice', 100, '🧀'), r('3', 'bob', 220, true, 'alice', 150)], new Set(['alice:100', 'alice:150']));
    const rows = new Map([['alice:100', { key: 'm1', time: 100 }], ['alice:150', { key: 'm2', time: 150 }]]);
    const pending = pendingReactionTargets(active, 'alice', rows, undefined, 0);
    expect(pending.map(p => p.key)).toEqual(['m1', 'm2']);
    // Seeing a reply (a separate store) has no effect; seeing m1's reactions leaves m2 pending.
    expect(pendingReactionTargets(active, 'alice', rows, { pending: [], seen: ['1', '2'] }, 0).map(p => p.key)).toEqual(['m2']);
  });
});
