import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useCheeseAmpAutoAdvance } from '@/hooks/useCheeseAmpAutoAdvance';
import { useCheeseAmpStore } from '@/stores/cheeseAmpStore';

const { fetchMock, rpcMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), rpcMock: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: () => ({ accountName: 'soundtester1' }) }));
vi.mock('@/lib/fetchWithFallback', () => ({ fetchWithFallback: fetchMock }));
vi.mock('@/lib/waxRpcFallback', () => ({ waxRpcCall: rpcMock }));

function renderAt(path: string) {
  return renderHook(() => useCheeseAmpAutoAdvance('soundtester1'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    ),
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('CHEESEAmp background NFT scan gate', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useCheeseAmpStore.setState({ hasBeenOpened: false, isMinimized: false });
    rpcMock.mockResolvedValue({ rows: [
      { asset_id: '101', collection_name: 'sounds', schema_name: 'sfx', template_id: 1 },
    ], more: false });
    fetchMock.mockImplementation(async (_endpoints, path: string) => {
      const params = new URL(path, 'https://api.example').searchParams;
      const data = params.has('ids')
        ? [{ asset_id: '101', immutable_data: { Audio: 'bafkreipage' } }]
        : [];
      return { json: async () => ({ success: true, data }) };
    });
  });
  afterEach(cleanup);

  it('does not look up music NFTs until CHEESEAmp is opened', async () => {
    renderAt('/');
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();

    act(() => {
      useCheeseAmpStore.getState().markOpened();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('stays silent on the CHEESECrypt route even after CHEESEAmp was opened', async () => {
    act(() => {
      useCheeseAmpStore.getState().markOpened();
    });

    renderAt('/crypt');
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
