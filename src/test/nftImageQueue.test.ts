import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNftImageQueue } from '@/lib/nftImageQueue';

class TestImage {
  static requests: TestImage[] = [];
  naturalWidth = 370;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url = '';
  set src(value: string) { this.url = value; TestImage.requests.push(this); }
  removeAttribute() { this.url = ''; }
}

beforeEach(() => {
  vi.useFakeTimers();
  TestImage.requests = [];
  vi.stubGlobal('Image', TestImage);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('NFT grid image pool', () => {
  it('starts only eight downloads even with 92 queued tiles', () => {
    const queue = createNftImageQueue();
    for (let i = 0; i < 92; i++) queue(`image-${i}`, vi.fn(), vi.fn());
    expect(TestImage.requests).toHaveLength(8);
    TestImage.requests[0].onload?.();
    expect(TestImage.requests).toHaveLength(9);
    expect(TestImage.requests[8].url).toBe('image-8');
  });

  it('does not spend the six-second deadline while queued', () => {
    const queue = createNftImageQueue(1);
    const failure = vi.fn();
    queue('first', vi.fn(), vi.fn());
    queue('waiting', vi.fn(), failure);
    vi.advanceTimersByTime(6000);
    expect(TestImage.requests[1].url).toBe('waiting');
    expect(failure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5999);
    expect(failure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(failure).toHaveBeenCalledTimes(1);
  });

  it('cancels queued work without starting it', () => {
    const queue = createNftImageQueue(1);
    queue('active', vi.fn(), vi.fn());
    const cancel = queue('offscreen', vi.fn(), vi.fn());
    cancel();
    TestImage.requests[0].onload?.();
    expect(TestImage.requests).toHaveLength(1);
  });

  it('cancels active work and ignores late results while releasing its slot', () => {
    const queue = createNftImageQueue(1);
    const success = vi.fn();
    const failure = vi.fn();
    const cancel = queue('active', success, failure);
    const lateLoad = TestImage.requests[0].onload;
    queue('next', vi.fn(), vi.fn());
    cancel();
    cancel();
    lateLoad?.();
    expect(TestImage.requests[0].url).toBe('');
    expect(TestImage.requests[1].url).toBe('next');
    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });

  it('rejects zero-width artwork and frees the slot on failure', () => {
    const queue = createNftImageQueue(1);
    const failure = vi.fn();
    queue('broken', vi.fn(), failure);
    queue('next', vi.fn(), vi.fn());
    TestImage.requests[0].naturalWidth = 0;
    TestImage.requests[0].onload?.();
    expect(failure).toHaveBeenCalledTimes(1);
    expect(TestImage.requests[1].url).toBe('next');
  });
});