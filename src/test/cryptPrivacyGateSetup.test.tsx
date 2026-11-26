import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CryptPrivacyGate } from '@/components/crypt/CryptPrivacyGate';
import { loadCustomEndpoint, loadCustomOnly, loadPrivacyGateChoice, privacyGateSatisfied } from '@/lib/cryptNetworkPrivacy';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

let done = 0;
const okFetch = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ actions: [] }) });

it('tests the restored local helper address before enabling exclusive history', async () => {
  const fetcher = okFetch();
  vi.stubGlobal('fetch', fetcher);
  done = 0;
  render(<CryptPrivacyGate onDone={() => { done += 1; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my own server first' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Your history server address' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Autofill Tor helper' }));
  expect(loadCustomEndpoint()).toBeNull();
  const box = screen.getByRole('checkbox', { name: /Use only this server/i });
  expect(box).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Test this server' }));
  await waitFor(() => expect(done).toBe(1));
  expect(String(fetcher.mock.calls[0][0])).toMatch(/^http:\/\/localhost:8088\//);
  expect(loadCustomEndpoint()).toBe('http://localhost:8088');
  expect(loadCustomOnly()).toBe(true);
  expect(loadPrivacyGateChoice()).toBe('private');
  expect(privacyGateSatisfied()).toBe(true);
});

it('keeps public servers as backup when the only-server box is unticked', async () => {
  vi.stubGlobal('fetch', okFetch());
  done = 0;
  render(<CryptPrivacyGate onDone={() => { done += 1; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my own server first' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Use only this server/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Test this server' }));
  await waitFor(() => expect(done).toBe(1));
  expect(loadCustomEndpoint()).toBe('http://localhost:8088');
  expect(loadCustomOnly()).toBe(false);
  expect(loadPrivacyGateChoice()).toBe('public');
  expect(privacyGateSatisfied()).toBe(true);
});

it('saves nothing when the test fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  done = 0;
  render(<CryptPrivacyGate onDone={() => { done += 1; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my own server first' }));
  fireEvent.click(screen.getByRole('button', { name: 'Test this server' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(done).toBe(0);
  expect(loadCustomEndpoint()).toBeNull();
  expect(loadPrivacyGateChoice()).toBeNull();
});
