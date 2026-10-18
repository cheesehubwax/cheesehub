import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMusicNFTs } from '@/hooks/useMusicNFTs';

const { fetchMock, rpcMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), rpcMock: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: () => ({ accountName: 'soundtester1' }) }));
vi.mock('@/lib/fetchWithFallback', () => ({ fetchWithFallback: fetchMock }));
vi.mock('@/lib/waxRpcFallback', () => ({ waxRpcCall: rpcMock }));

describe('music NFT metadata loading', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ rows: [
      { asset_id: '101', collection_name: 'sounds', schema_name: 'sfx', template_id: 1 },
      { asset_id: '102', collection_name: 'sounds', schema_name: 'sfx', template_id: 2 },
    ], more: false });
    fetchMock.mockImplementation(async (_endpoints, path: string) => {
      const params = new URL(path, 'https://api.example').searchParams;
      const data = params.has('ids')
        ? [{ asset_id: '102', immutable_data: { Audio: 'bafkreibatch' } }]
        : params.get('page') === '1'
          ? [{ asset_id: '101', template: { immutable_data: { Audio: 'bafkreipage' } } }]
          : [];
      return { json: async () => ({ success: true, data }) };
    });
  });
  afterEach(cleanup);

  it('loads Audio from owner pages and ID fallback, converts bafk CIDs, and ignores the old classification cache', async () => {
    localStorage.setItem('cheesehub_music_nfts_soundtester1', JSON.stringify({ nfts: [], timestamp: Date.now(), assetIds: [] }));
    const { result } = renderHook(() => useMusicNFTs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nfts.map(nft => [nft.asset_id, nft.audioUrl])).toEqual([
      ['102', 'https://ipfs.io/ipfs/bafkreibatch'],
      ['101', 'https://ipfs.io/ipfs/bafkreipage'],
    ]);
    expect(fetchMock).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('cheesehub_music_nfts_v2_soundtester1') ?? '{}').nfts).toHaveLength(2);
  });
});