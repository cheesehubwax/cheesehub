import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaxContext } from '@/context/waxContextState';
import type { WaxContextType } from '@/context/WaxContext';

vi.mock('@/lib/wharfKit', () => ({ sessionKit: {}, closeWharfkitModals: vi.fn(), setLoginInProgress: vi.fn(), getTransactPlugins: vi.fn() }));
vi.mock('@/lib/chainRequest', () => ({ chainPost: vi.fn() }));

describe('wallet context refresh identity', () => {
  it('a refreshed consumer reads the retained provider instead of losing its wallet', async () => {
    const retainedContext = WaxContext;
    // Approximate Fast Refresh: re-evaluate the component module, preserving
    // its unchanged context dependency as Vite does.
    vi.doMock('@/context/waxContextState', () => ({ WaxContext: retainedContext }));
    vi.resetModules();
    const { useWax } = await import('@/context/WaxContext');
    function RefreshedConsumer() {
      const wallet = useWax();
      return <output>{wallet.accountName}</output>;
    }
    render(<retainedContext.Provider value={{ accountName: 'alice', isConnected: true } as WaxContextType}><RefreshedConsumer /></retainedContext.Provider>);
    expect(screen.getByText('alice')).toBeInTheDocument();
    vi.doUnmock('@/context/waxContextState');
  });
});