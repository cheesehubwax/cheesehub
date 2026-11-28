import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CryptMessageBoundary } from '@/components/crypt/CryptMessageBoundary';
import { findCryptMessageNode } from '@/lib/cryptMessageDom';
import { cryptDiagnostic } from '@/lib/cryptDiagnostics';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Crypt message crash isolation', () => {
  it('captures a sanitized diagnostic and source-only stack without logging the exception object', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new TypeError("Cannot read properties of undefined (reading 'localeCompare')");
    error.stack = error.message + '\n    at secretMessage (http://localhost:8080/src/pages/CheeseCrypt.tsx?t=123:70:4)';
    function Broken(): never { throw error; }
    const boundary = { current: null as CryptMessageBoundary | null };
    render(<CryptMessageBoundary ref={boundary}><Broken /></CryptMessageBoundary>);
    expect(boundary.current?.state.diagnostic).toEqual({ name: 'TypeError', message: error.message, stack: error.name + ': ' + error.message + '\n    at /src/pages/CheeseCrypt.tsx:70:4' });
    const diagnosticLog = log.mock.calls.filter(call => typeof call[0] === 'string' && call[0].startsWith('[CHEESECrypt render failure]'));
    expect(diagnosticLog).toHaveLength(1);
    expect(diagnosticLog[0]).toEqual(['[CHEESECrypt render failure]\n' + boundary.current?.state.diagnostic?.stack]);
  });
  it('withholds arbitrary message/key content and unexpected error names', () => {
    const error = new Error('Decrypted secret message CRYPTKEY1:private-key');
    error.name = 'Another secret';
    error.stack = error.message;
    expect(cryptDiagnostic(error)).toEqual({ name: 'Error', message: 'Error details withheld for privacy.', stack: 'Error: Error details withheld for privacy.' });
    expect(cryptDiagnostic(new TypeError("Cannot read properties of null (reading 'privateMessage')")).message).toBe("Cannot read properties of null (reading '[redacted]')");
    expect(cryptDiagnostic(new TypeError('privateMessage.map is not a function')).message).toBe('[value].map is not a function');
  });
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