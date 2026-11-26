import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CryptPrivacyGate } from '@/components/crypt/CryptPrivacyGate';
import { loadCustomEndpoint, loadCustomOnly } from '@/lib/cryptNetworkPrivacy';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

it('tests the restored local helper address before enabling exclusive history', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ actions: [] }) });
  vi.stubGlobal('fetch', fetcher);
  const onDone = vi.fn();
  render(<CryptPrivacyGate onDone={onDone} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my own server first' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Your history server address' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Autofill Tor helper' }));
  expect(loadCustomEndpoint()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Test and use only this server' }));
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(String(fetcher.mock.calls[0][0])).toMatch(/^http:\/\/localhost:8088\//);
  expect(loadCustomEndpoint()).toBe('http://localhost:8088');
  expect(loadCustomOnly()).toBe(true);
});