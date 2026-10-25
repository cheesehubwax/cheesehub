import "@testing-library/jest-dom";
import { beforeEach } from 'vitest';
import { clearSessionKeys } from '@/lib/cheeseCrypt';
import { clearVerifiedKeys } from '@/lib/cryptKeyLock';

beforeEach(() => { clearSessionKeys(); clearVerifiedKeys(); });

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
