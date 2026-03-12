import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { Loader2, Sprout, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { fetchWithFallback } from '@/lib/fetchWithFallback';

const WAX_ENDPOINTS = ['https://wax.eosusa.io', 'https://api.wax.alohaeos.com', 'https://wax.cryptolions.io'];

interface IncentiveRow {
  id: number;
  creator: string;
  reward: { quantity: string; contract: string };
  periodFinish: number;
  rewardsDuration: number;
  rewardRateE18: string;
  rewardPerTokenStoredE18: string;
  totalStakingWeight: string;
  lastUpdateTime: number;
}

interface StakeRow {
  id: number;
  owner: string;
  incentiveId: number;
  liquidity: string;
  rewardPerTokenStoredE18: string;
  rewardsE18: string;
}

interface UserFarmPosition {
  incentiveId: number;
  staked: string;
  pendingReward: string;
  rewardSymbol: string;
  rewardContract: string;
}

interface AlcorFarmManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

export function AlcorFarmManager({ onTransactionComplete, onTransactionSuccess }: AlcorFarmManagerProps) {
  const { session, accountName } = useWax();
  const [isLoading, setIsLoading] = useState(false);
  const [positions, setPositions] = useState<UserFarmPosition[]>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!accountName) return;
    setIsLoading(true);
    try {
      const stakesRes = await fetchWithFallback(WAX_ENDPOINTS, '/v1/chain/get_table_rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'alcorammswap',
          scope: 'alcorammswap',
          table: 'stakes',
          index_position: 2,
          key_type: 'name',
          lower_bound: accountName,
          upper_bound: accountName,
          limit: 100,
          json: true,
        }),
      });
      const stakesData = await stakesRes.json();
      const stakes: StakeRow[] = stakesData.rows || [];

      if (stakes.length === 0) {
        setPositions([]);
        setIsLoading(false);
        return;
      }

      const incentiveIds = [...new Set(stakes.map(s => s.incentiveId))];
      const incentiveRes = await fetchWithFallback(WAX_ENDPOINTS, '/v1/chain/get_table_rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'alcorammswap',
          scope: 'alcorammswap',
          table: 'incentives',
          json: true,
          limit: 100,
        }),
      });
      const incentiveData = await incentiveRes.json();
      const incentives: IncentiveRow[] = incentiveData.rows || [];
      const incentiveMap = new Map(incentives.map(i => [i.id, i]));

      const userPositions: UserFarmPosition[] = stakes.map(stake => {
        const incentive = incentiveMap.get(stake.incentiveId);
        const rewardParts = incentive?.reward?.quantity?.split(' ') || ['0', 'TOKEN'];
        return {
          incentiveId: stake.incentiveId,
          staked: stake.liquidity,
          pendingReward: (parseFloat(stake.rewardsE18 || '0') / 1e18).toFixed(4),
          rewardSymbol: rewardParts[1] || 'TOKEN',
          rewardContract: incentive?.reward?.contract || '',
        };
      });

      setPositions(userPositions);
    } catch (error) {
      console.error('Failed to fetch Alcor farm positions:', error);
      toast.error('Failed to load farm positions');
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleClaim = async (incentiveId: number) => {
    if (!session || !accountName) return;
    setClaimingId(incentiveId);
    try {
      const actions = [{
        account: 'alcorammswap',
        name: 'getreward',
        authorization: [session.permissionLevel],
        data: { owner: accountName, incentive_id: incentiveId },
      }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('Rewards Claimed!', `Claimed rewards from Alcor Farm #${incentiveId}`, txId);
      fetchPositions();
      onTransactionComplete?.();
    } catch (error: any) {
      closeWharfkitModals();
      const msg = error?.message || 'Failed to claim';
      if (!msg.toLowerCase().includes('cancel')) toast.error(msg);
    } finally {
      setClaimingId(null);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  const handleClaimAll = async () => {
    if (!session || !accountName || positions.length === 0) return;
    setClaimingId(-1);
    try {
      const actions = positions.map(p => ({
        account: 'alcorammswap',
        name: 'getreward',
        authorization: [session.permissionLevel],
        data: { owner: accountName, incentive_id: p.incentiveId },
      }));
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('All Rewards Claimed!', `Claimed rewards from ${positions.length} farm(s)`, txId);
      fetchPositions();
      onTransactionComplete?.();
    } catch (error: any) {
      closeWharfkitModals();
      const msg = error?.message || 'Failed to claim';
      if (!msg.toLowerCase().includes('cancel')) toast.error(msg);
    } finally {
      setClaimingId(null);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sprout className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Manage Alcor Farms</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchPositions} className="h-8 w-8">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <Sprout className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No active Alcor farm positions found.</p>
          <a
            href="https://wax.alcor.exchange/farm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Visit Alcor Exchange to start farming
          </a>
        </div>
      ) : (
        <>
          {positions.length > 1 && (
            <Button
              onClick={handleClaimAll}
              disabled={claimingId !== null}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {claimingId === -1 ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Claiming All...</>
              ) : (
                `Claim All Rewards (${positions.length} farms)`
              )}
            </Button>
          )}

          <div className="space-y-3">
            {positions.map(pos => (
              <div key={pos.incentiveId} className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Farm #{pos.incentiveId}</span>
                  <span className="font-medium text-primary">{pos.rewardSymbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Staked LP:</span>
                  <span className="font-medium">{pos.staked}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending Reward:</span>
                  <span className="font-medium text-green-500">{pos.pendingReward} {pos.rewardSymbol}</span>
                </div>
                <Button
                  onClick={() => handleClaim(pos.incentiveId)}
                  disabled={claimingId !== null}
                  variant="outline"
                  size="sm"
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                >
                  {claimingId === pos.incentiveId ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Claiming...</>
                  ) : (
                    'Claim Reward'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
