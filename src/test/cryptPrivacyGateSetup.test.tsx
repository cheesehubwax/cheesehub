import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CryptPrivacyGate } from '@/components/crypt/CryptPrivacyGate';
import { loadCustomEndpoint, loadCustomOnly, loadPrivacyGateChoice, privacyGateSatisfied } from '@/lib/cryptNetworkPrivacy';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

let done = 0;
const okFetch = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ actions: [] }) });
const open = () => {
  render(<CryptPrivacyGate onDone={() => { done += 1; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my own server first' }));
};

it('tests the restored local helper address, reports success, then enables exclusive history on continue', async () => {
  const fetcher = okFetch();
  vi.stubGlobal('fetch', fetcher);
  done = 0;
  open();
  fireEvent.change(screen.getByRole('textbox', { name: 'Your history server address' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Autofill Tor helper' }));
  expect(loadCustomEndpoint()).toBeNull();
  expect(screen.getByRole('checkbox', { name: /Use only this server/i })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Test this server' }));
  await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  expect(done).toBe(0);
  expect(screen.getByRole('status').textContent).toContain('Only this server will be used');
  expect(String(fetcher.mock.calls[0][0])).toMatch(/^http:\/\/localhost:8088\//);
  expect(loadCustomEndpoint()).toBe('http://localhost:8088');
  expect(loadCustomOnly()).toBe(true);
  expect(loadPrivacyGateChoice()).toBe('private');
  expect(privacyGateSatisfied()).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to CHEESECrypt' }));
  expect(done).toBe(1);
});

it('keeps public servers as backup when the only-server box is unticked', async () => {
  vi.stubGlobal('fetch', okFetch());
  done = 0;
  open();
  fireEvent.click(screen.getByRole('checkbox', { name: /Use only this server/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Test this server' }));
  await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  expect(screen.getByRole('status').textContent).toContain('public servers as backup');
  fireEvent.click(screen.getByRole('button', { name: 'Continue to CHEESECrypt' }));
  expect(done).toBe(1);
  expect(loadCustomEndpoint()).toBe('http://localhost:8088');
  expect(loadCustomOnly()).toBe(false);
  expect(loadPrivacyGateChoice()).toBe('public');
  expect(privacyGateSatisfied()).toBe(true);
});

it('reports a failed test and saves nothing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  done = 0;
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Test this server' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.getByRole('alert').textContent).toContain('Cannot reach the local helper');
  expect(done).toBe(0);
  expect(screen.queryByRole('button', { name: 'Continue to CHEESECrypt' })).toBeNull();
  expect(loadCustomEndpoint()).toBeNull();
  expect(loadPrivacyGateChoice()).toBeNull();
});

it('rejects an unusable address without contacting anything', () => {
  const fetcher = okFetch();
  vi.stubGlobal('fetch', fetcher);
  done = 0;
  open();
  fireEvent.change(screen.getByRole('textbox', { name: 'Your history server address' }), { target: { value: 'ftp://example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Test this server' }));
  expect(screen.getByRole('alert').textContent).toContain('Use an https:// address');
  expect(fetcher).not.toHaveBeenCalled();
  expect(done).toBe(0);
});
