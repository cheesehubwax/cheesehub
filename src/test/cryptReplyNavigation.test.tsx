import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCryptReplyNavigation } from '@/hooks/useCryptReplyNavigation';
import { encodeReply } from '@/lib/cryptReply';

const messages = Array.from({ length: 6 }, (_, i) => ({ key: `reply-${i}`, from: 'bob', time: i + 10,
  text: encodeReply({ author: 'alice', time: 1, quote: 'hello' }, `answer ${i}`), missing: 0 }));
function Room({ active = 'bob', thread = messages, resumeAt = 5, onRead }: { active?: string; thread?: typeof messages; resumeAt?: number; onRead?: (time: number) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const nav = useCryptReplyNavigation('alice', active, thread, resumeAt, list, onRead);
  return <><button onClick={nav.jump}>@{nav.pending.length}</button><ol ref={list} onScroll={nav.inspectVisible}>
    {thread.map(m => <li key={m.key} data-reply-key={m.key} data-highlighted={nav.highlighted.has(m.key)}>{m.key}</li>)}
  </ol></>;
}
const bounds = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) });
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
function flushFrame() {
  act(() => { const queued = [...frames.values()]; frames.clear(); queued.forEach(cb => cb(0)); });
}
beforeEach(() => {
  localStorage.clear(); frames = new Map(); frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++frameId, cb); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
    const onRead = vi.fn();
    render(<Room onRead={onRead} />);
    const list = screen.getByRole('list');
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(bounds(100, 500));
    messages.forEach((m, i) => vi.spyOn(screen.getByText(m.key), 'getBoundingClientRect').mockReturnValue(bounds(i === 2 ? 200 : 800, i === 2 ? 260 : 860)));
    fireEvent.scroll(list);
    flushFrame();
    expect(screen.getByRole('button').textContent).toBe('@5');
    expect(screen.getByText('reply-2').dataset.highlighted).toBe('true');
    expect(onRead).toHaveBeenCalledWith(12);
    expect(onRead).not.toHaveBeenCalledWith(15);
    fireEvent.scroll(list);
    flushFrame();
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
    flushFrame();
    expect(screen.getByRole('button').textContent).toBe('@6');
  });
  it('coalesces scroll bursts and does not report the same visible timestamp again after receipt renders', () => {
    const onRead = vi.fn();
    render(<Room onRead={onRead} />);
    const list = screen.getByRole('list');
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(bounds(100, 500));
    const measure = vi.spyOn(screen.getByText('reply-0'), 'getBoundingClientRect').mockReturnValue(bounds(200, 260));
    for (let i = 0; i < 100; i++) fireEvent.scroll(list);
    expect(frames.size).toBe(1);
    flushFrame();
    expect(measure).toHaveBeenCalledTimes(1);
    expect(onRead).toHaveBeenCalledTimes(1);
    expect(onRead).toHaveBeenCalledWith(10);
    fireEvent.scroll(list); flushFrame();
    expect(onRead).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').textContent).toBe('@5');
  });
  it('retains one observer across receipt and parent renders, and reconnects only when the chat changes', () => {
    const disconnect = vi.fn();
    const create = vi.fn(function () { return { observe: vi.fn(), unobserve: vi.fn(), disconnect }; });
    vi.stubGlobal('IntersectionObserver', create);
    const view = render(<Room />);
    expect(create).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button'));
    view.rerender(<Room onRead={() => {}} />);
    expect(create).toHaveBeenCalledTimes(1);
    view.rerender(<Room active="carol" thread={[]} />);
    expect(create).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
  });
  it('keeps reply navigation working when device storage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    render(<Room />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('@5');
    expect(screen.getByText('reply-0').dataset.highlighted).toBe('true');
  });
  it('keeps wire/control-character message identities intact when jumping and restoring receipts', () => {
    const key = 'cg2:tx:bob:room:\u0004R1:quote\n"[end]\\';
    const rows = [{ ...messages[0], key }, messages[1]];
    const view = render(<Room thread={rows} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('@1');
    expect(document.querySelector('[data-highlighted="true"]')?.getAttribute('data-reply-key')).toBe(key);
    view.unmount();
    render(<Room thread={rows} resumeAt={100} />);
    expect(screen.getByRole('button').textContent).toBe('@1');
  });
  it('reattaches visibility tracking after the same conversation viewport is replaced', () => {
    const roots: Element[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn(function (_: unknown, options: IntersectionObserverInit) {
      if (options.root instanceof Element) roots.push(options.root);
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect };
    }));
    function RecoverableRoom({ version }: { version: number }) {
      const list = useRef<HTMLOListElement | null>(null);
      const [element, setElement] = useState<HTMLOListElement | null>(null);
      const bind = useCallback((node: HTMLOListElement | null) => { list.current = node; setElement(node); }, []);
      const nav = useCryptReplyNavigation('alice', 'bob', messages, 5, list, undefined, element);
      return <><button onClick={nav.jump}>@{nav.pending.length}</button><ol ref={bind} key={version} onScroll={nav.inspectVisible}>
        {messages.map(m => <li key={m.key} data-reply-key={m.key}>{m.key}</li>)}
      </ol></>;
    }
    const view = render(<RecoverableRoom version={1} />);
    const original = screen.getByRole('list');
    view.rerender(<RecoverableRoom version={2} />);
    const replacement = screen.getByRole('list');
    expect(replacement).not.toBe(original);
    expect(roots.at(-1)).toBe(replacement);
    expect(disconnect).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('@5');
  });
});