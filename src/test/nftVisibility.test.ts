import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeNftVisibility } from '@/lib/nftVisibility';

afterEach(() => vi.unstubAllGlobals());

describe('shared NFT visibility', () => {
  it('uses one observer for 364 tiles, isolates notifications and releases all targets', () => {
    let notify: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {};
    const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
    const constructed = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof notify) { constructed(); notify = callback; }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    });
    const callbacks = Array.from({ length: 364 }, () => vi.fn());
    const elements = callbacks.map(() => document.createElement('div'));
    const stops = elements.map((element, i) => observeNftVisibility(element, callbacks[i]));
    expect(constructed).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledTimes(364);
    notify([{ target: elements[100], isIntersecting: true }]);
    expect(callbacks[100]).toHaveBeenCalledWith(true);
    expect(callbacks[99]).not.toHaveBeenCalled();
    stops[100]();
    notify([{ target: elements[100], isIntersecting: false }]);
    expect(callbacks[100]).toHaveBeenCalledTimes(1);
    stops.forEach((stop, i) => { if (i !== 100) stop(); });
    expect(unobserve).toHaveBeenCalledTimes(364);
    expect(disconnect).toHaveBeenCalledTimes(1);
    const stop = observeNftVisibility(document.createElement('div'), vi.fn());
    expect(constructed).toHaveBeenCalledTimes(2);
    stop();
  });
});