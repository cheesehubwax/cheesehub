import { afterEach, describe, expect, it, vi } from 'vitest';
import { abortableDelay, fetchPage } from '@/lib/folio/providers';

afterEach(() => vi.unstubAllGlobals());

describe('CHEESEFolio sync stops promptly', () => {
  it('a history page request ends as soon as the scan is stopped, without retrying', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    const ctrl = new AbortController();
    const t0 = Date.now();
    const page = fetchPage('https://example.test/page', ctrl.signal);
    setTimeout(() => ctrl.abort(), 20);
    expect(await page).toBeNull();
    expect(Date.now() - t0).toBeLessThan(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retry waits end early when stopped', async () => {
    const ctrl = new AbortController();
    const t0 = Date.now();
    setTimeout(() => ctrl.abort(), 10);
    await abortableDelay(10_000, ctrl.signal);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
