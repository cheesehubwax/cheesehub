import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCryptReactionNavigation } from '@/hooks/useCryptReactionNavigation';
import { activeReactions, encodeReaction } from '@/lib/cryptReactions';
import { clearCryptLookupCache } from '@/lib/cryptStorage';

const wireKey = 'cg2:tx:alice:room:\u0004R1:quote\n"[row]\\';
const reactions = activeReactions([{ key: 'reaction', from: 'bob', time: 20, missing: 0,
  text: encodeReaction({ add: true, author: 'alice', time: 10, emoji: '🧀' }) }], new Set(['alice:10']));
const rows = new Map([['alice:10', { key: wireKey, time: 10 }]]);
function Room({ show = true }: { show?: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  const nav = useCryptReactionNavigation('alice', 'group:room', reactions, rows, 0, list);
  return <><button onClick={nav.jump}>Reactions {nav.pending.length}</button><ol ref={list}>
    {show && <li data-reply-key={wireKey}>My message</li>}
  </ol></>;
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); clearCryptLookupCache(); });
describe('reaction navigation crash safety', () => {
  it('works when browser storage is full and keeps the original wire identity', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    render(<Room />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Reactions 0');
    expect(screen.getByText('My message')).toHaveAttribute('data-reply-key', wireKey);
  });
  it('does not mark reactions seen when their message is not rendered', () => {
    const view = render(<Room show={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Reactions 1');
    view.rerender(<Room />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Reactions 0');
  });
});