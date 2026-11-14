import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CryptPrivacyDialog } from '@/components/crypt/CryptPrivacyDialog';
import { loadCustomEndpoint, loadCustomOnly, saveCustomEndpoint } from '@/lib/cryptNetworkPrivacy';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

const props = {
  onOpenChange: vi.fn(), mode: 'standard' as const, setMode: vi.fn(),
  loadFullHistory: vi.fn(), idleMinutes: 30 as const, setIdleMinutes: vi.fn(),
  shieldOn: false, setShieldOn: vi.fn(), hardening: { cold: false }, setHardening: vi.fn(),
};
const checkbox = () => screen.getByRole('checkbox', { name: 'Use only this server (no public servers if it fails)' });

describe('privacy checkbox persistence', () => {
  it('stays checked after closing and reopening before a server is connected', () => {
    const view = render(<CryptPrivacyDialog {...props} open />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom history server' }), { target: { value: 'http://localhost:8088' } });
    fireEvent.click(checkbox());
    view.rerender(<CryptPrivacyDialog {...props} open={false} />);
    view.rerender(<CryptPrivacyDialog {...props} open />);
    expect(checkbox()).toBeChecked();
    expect(loadCustomEndpoint()).toBeNull();
    expect(loadCustomOnly()).toBe(false);
  });

  it('retains the preference after a failed test, then activates only after success', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ actions: [] }) });
    vi.stubGlobal('fetch', fetcher);
    const view = render(<CryptPrivacyDialog {...props} open />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom history server' }), { target: { value: 'http://localhost:8088' } });
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole('button', { name: 'Test & connect server' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Test & connect server' })).toBeEnabled());
    expect(loadCustomEndpoint()).toBeNull();
    view.rerender(<CryptPrivacyDialog {...props} open={false} />);
    view.rerender(<CryptPrivacyDialog {...props} open />);
    expect(checkbox()).toBeChecked();
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom history server' }), { target: { value: 'http://localhost:8088' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test & connect server' }));
    await waitFor(() => expect(loadCustomOnly()).toBe(true));
    expect(loadCustomEndpoint()).toBe('http://localhost:8088');
  });

  it('persists toggles in both directions for an already connected server', () => {
    saveCustomEndpoint('http://localhost:8088', false);
    const view = render(<CryptPrivacyDialog {...props} open />);
    fireEvent.click(checkbox());
    view.rerender(<CryptPrivacyDialog {...props} open={false} />);
    view.rerender(<CryptPrivacyDialog {...props} open />);
    expect(checkbox()).toBeChecked();
    expect(loadCustomOnly()).toBe(true);
    fireEvent.click(checkbox());
    view.rerender(<CryptPrivacyDialog {...props} open={false} />);
    view.rerender(<CryptPrivacyDialog {...props} open />);
    expect(checkbox()).not.toBeChecked();
    expect(loadCustomOnly()).toBe(false);
  });
});