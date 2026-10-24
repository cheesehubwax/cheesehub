import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCryptReplyNavigation } from '@/hooks/useCryptReplyNavigation';
import { encodeReply } from '@/lib/cryptReply';

const messages = Array.from({ length: 6 }, (_, i) => ({ key: `reply-${i}`, from: 'bob', time: i + 10,
  text: encodeReply({ author: 'alice', time: 1, quote: 'hello' }, `answer ${i}`), missing: 0 }));
function Room({ active = 'bob', thread = messages, resumeAt = 5 }: { active?: string; thread?: typeof messages; resumeAt?: number }) {
  const list = useRef<HTMLOListElement>(null);
  const nav = useCryptReplyNavigation('alice', active, thread, resumeAt, list);
  return <><button onClick={nav.jump}>@{nav.pending.length}</button><ol ref={list} onScroll={nav.inspectVisible}>
    {thread.map(m => <li key={m.key} data-reply-key={m.key} data-highlighted={nav.highlighted.has(m.key)}>{m.key}</li>)}
  </ol></>;
}
const bounds = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) });
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('in-room reply navigation', () => {
  it('six replies decrease to five when jumping to the earliest and highlight that exact post', () => {
    render(<Room />);
    expect(screen.getByRole('button').textContent).toBe('@6');
    const list = screen.getByRole('list');
    const scroll = vi.fn();
    Object.defineProperty(list, 'scrollTo', { value: scroll, configurable: true });
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(bounds(100, 500));
    vi.spyOn(screen.getByText('reply-0'), 'getBoundingClientRect').mockReturnValue(bounds(900, 950));
    fireEvent.click(screen.getByRole('button'));
    expect(scroll).toHaveBeenCalledWith({ top: 788, behavior: 'auto' });
    expect(screen.getByRole('button').textContent).toBe('@5');
    expect(screen.getByText('reply-0').dataset.highlighted).toBe('true');
    expect(screen.getByText('reply-1').dataset.highlighted).toBe('false');
  });
  it('ordinary scrolling consumes visible replies but not replies above or below the room', () => {
    render(<Room />);
    const list = screen.getByRole('list');
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(bounds(100, 500));
    messages.forEach((m, i) => vi.spyOn(screen.getByText(m.key), 'getBoundingClientRect').mockReturnValue(bounds(i === 2 ? 200 : 800, i === 2 ? 260 : 860)));
    fireEvent.scroll(list);
    expect(screen.getByRole('button').textContent).toBe('@5');
    expect(screen.getByText('reply-2').dataset.highlighted).toBe('true');
    fireEvent.scroll(list);
    expect(screen.getByRole('button').textContent).toBe('@5');
  });
  it('jumping past unread replies never loses them when switching chats or reloading with a newer read timestamp', () => {
    const view = render(<Room />);
    fireEvent.click(screen.getByRole('button'));
    view.rerender(<Room active="carol" thread={[]} />);
    expect(screen.getByRole('button').textContent).toBe('@0');
    view.rerender(<Room resumeAt={100} />);
    expect(screen.getByRole('button').textContent).toBe('@5');
    view.unmount();
    render(<Room resumeAt={100} />);
    expect(screen.getByRole('button').textContent).toBe('@5');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('@4');
    expect(screen.getByText('reply-1').dataset.highlighted).toBe('true');
  });
  it('counts only complete incoming replies to me, not own posts, plain messages, or replies to someone else', () => {
    render(<Room thread={[messages[0], { ...messages[1], from: 'alice' }, { ...messages[2], text: 'plain' },
      { ...messages[3], missing: 1 }, { ...messages[4], text: encodeReply({ author: 'carol', time: 1, quote: 'q' }, 'hi') }]} />);
    expect(screen.getByRole('button').textContent).toBe('@1');
  });
  it('new replies arriving while the chat is open join the queue', () => {
    const view = render(<Room thread={messages.slice(0, 1)} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('@0');
    view.rerender(<Room thread={messages.slice(0, 2)} />);
    expect(screen.getByRole('button').textContent).toBe('@1');
  });
  it('does not consume a room offscreen even when replies are inside its own scroll area', () => {
    render(<Room />);
    vi.spyOn(screen.getByRole('list'), 'getBoundingClientRect').mockReturnValue(bounds(-600, -100));
    vi.spyOn(screen.getByText('reply-0'), 'getBoundingClientRect').mockReturnValue(bounds(-500, -450));
    act(() => { fireEvent.scroll(screen.getByRole('list')); });
    expect(screen.getByRole('button').textContent).toBe('@6');
  });
});