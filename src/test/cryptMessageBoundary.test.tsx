import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CryptMessageBoundary } from '@/components/crypt/CryptMessageBoundary';
import { findCryptMessageNode } from '@/lib/cryptMessageDom';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Crypt message crash isolation', () => {
  it('isolates a failed row, preserves adjacent messages and retries without marking it read', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    function Message() {
      if (fail) throw new Error('Synthetic render failure');
      return <li data-reply-key="original">Recovered message</li>;
    }
    render(<><p>Room header</p><ol><li>Previous message</li><CryptMessageBoundary row><Message /></CryptMessageBoundary><li>Next message</li></ol><textarea aria-label="Message" /></>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Previous message')).toBeInTheDocument();
    expect(screen.getByText('Next message')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveAttribute('data-reply-key');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Recovered message')).toHaveAttribute('data-reply-key', 'original');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('allows switching to another conversation after a viewport failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never { throw new Error('Synthetic viewport failure'); }
    const view = render(<CryptMessageBoundary key="room"><Broken /></CryptMessageBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    view.rerender(<CryptMessageBoundary key="dm"><ol><li>Private message</li></ol></CryptMessageBoundary>);
    expect(screen.getByText('Private message')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('finds opaque wire keys without CSS.escape or interpolated selectors', () => {
    const key = '\u0004R1:quoted\n"[row]\\';
    render(<ol><li data-reply-key={key}>Reply</li><li data-reply-key="other">Other</li></ol>);
    expect(findCryptMessageNode(screen.getByRole('list') as HTMLOListElement, key)).toBe(screen.getByText('Reply'));
    expect(findCryptMessageNode(null, key)).toBeUndefined();
  });
});