import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// dao.waxdao::claimvoteram is rejected for every DAO type except type 5
// ("Hold NFTs (Non-Custodial)"), so the tab must not be offered elsewhere.
const state = vi.hoisted(() => ({ daoType: 4 }));

vi.mock('@/context/WaxContext', () => ({
  useWax: () => ({ isConnected: true, accountName: 'alice', session: null }),
}));

vi.mock('@/hooks/useWaxTransaction', () => ({
  useWaxTransaction: () => ({ executeTransaction: vi.fn(async () => ({ success: true })) }),
}));

vi.mock('@/lib/dao', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/dao')>();
  return {
    ...real,
    fetchDaoDetails: async () => ({
      dao_name: 'testdao',
      creator: 'alice',
      description: 'A test DAO',
      logo: '',
      cover_image: '',
      token_contract: 'eosio.token',
      token_symbol: '4,WAX',
      dao_type: state.daoType,
      proposer_type: 1,
      threshold: 1,
      hours_per_proposal: 24,
      minimum_weight: 0,
      minimum_votes: 0,
      proposal_cost: '0',
      authors: [],
      gov_schemas: [],
      time_created: 0,
      status: 0,
    }),
    fetchProposals: async () => [],
    fetchDaoTreasury: async () => [],
    fetchDaoTreasuryNFTs: async () => [],
    checkDaoMembership: async () => false,
    fetchUserStakedTokens: async () => null,
  };
});

import { DaoDetail } from '@/components/dao/DaoDetail';

afterEach(() => {
  cleanup();
});

async function openDetail(daoType: number) {
  state.daoType = daoType;
  render(<DaoDetail daoName="testdao" onBack={vi.fn()} />);
  await screen.findByText('testdao');
}

describe('Claim Vote RAM tab', () => {
  it('is hidden for a custodial staking DAO (type 4)', async () => {
    await openDetail(4);
    expect(screen.queryByText('Claim Vote RAM')).toBeNull();
  });

  it('is offered for a non-custodial NFT DAO (type 5)', async () => {
    await openDetail(5);
    fireEvent.click(screen.getByText('Claim Vote RAM'));
    expect(await screen.findByText('No ended proposals to reclaim RAM from')).toBeTruthy();
  });
});
