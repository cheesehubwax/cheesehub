import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { cn } from '@/lib/utils';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';

const WAX_ENDPOINTS = ['https://wax.eosusa.io', 'https://api.wax.alohaeos.com', 'https://wax.cryptolions.io'];

interface VoteRewardsManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

export function VoteRewardsManager({ onTransactionComplete, onTransactionSuccess }: VoteRewardsManagerProps) {
  const { session, accountName } = useWax();
  const [isTransacting, setIsTransacting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState('');
  const [lastClaimTime, setLastClaimTime] = useState<Date | null>(null);
  const [estimatedRewards, setEstimatedRewards] = useState(0);
  const [stakedAmount, setStakedAmount] = useState(0);
  const [proxyName, setProxyName] = useState('');
  const [producerCount, setProducerCount] = useState(0);

  useEffect(() => { if (accountName) fetchVoterData(); }, [accountName]);

  const fetchVoterData = async () => {
    if (!accountName) return;
    setIsLoading(true);
    try {
      const voterResponse = await fetchWithFallback(WAX_ENDPOINTS, '/v1/chain/get_table_rows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'eosio', scope: 'eosio', table: 'voters', lower_bound: accountName, upper_bound: accountName, limit: 1, json: true }),
      });
      const voterData = await voterResponse.json();

      if (voterData.rows?.length > 0) {
        const voter = voterData.rows[0];
        const isVoting = (voter.producers?.length > 0) || (voter.proxy && voter.proxy !== '');
        setHasVoted(isVoting);
        setStakedAmount(voter.staked / 100000000);
        setProxyName(voter.proxy || '');
        setProducerCount(voter.producers?.length || 0);

        let lastUpdatedTime: Date;
        if (voter.last_claim_time && voter.last_claim_time !== '1970-01-01T00:00:00') lastUpdatedTime = new Date(voter.last_claim_time + 'Z');
        else lastUpdatedTime = new Date(0);
        setLastClaimTime(lastUpdatedTime);

        const now = new Date();
        const nextClaimDate = new Date(lastUpdatedTime.getTime() + 24 * 60 * 60 * 1000);
        if (lastUpdatedTime.getTime() === 0) { setNextClaimTime('Now!'); setCanClaim(true); }
        else if (now >= nextClaimDate) { setNextClaimTime('Now!'); setCanClaim(true); }
        else {
          const remaining = nextClaimDate.getTime() - now.getTime();
          setNextClaimTime(`${Math.floor(remaining / (1000 * 60 * 60))}h ${Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))}m`);
          setCanClaim(false);
        }
      } else { setHasVoted(false); }
    } catch (error) { toast.error('Failed to load voter info'); }
    finally { setIsLoading(false); }
  };

  const handleClaimVote = async () => {
    if (!session || !accountName) return;
    setIsTransacting(true);
    try {
      const actions = [{ account: 'eosio', name: 'claimgbmvote', authorization: [session.permissionLevel], data: { owner: accountName } }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('Vote Rewards Claimed!', 'Claimed voting rewards.', txId);
      await fetchVoterData();
      onTransactionComplete?.();
    } catch (error: any) {
      closeWharfkitModals();
      const errorMsg = error?.message || 'Failed to claim';
      if (errorMsg.includes('nothing to claim')) toast.error('No vote rewards available');
      else toast.error(errorMsg);
    } finally { setIsTransacting(false); closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 300); }
  };

  const formatDate = (date: Date | null): string => {
    if (!date || date.getTime() === 0) return 'Never';
    return date.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4"><Gift className="h-5 w-5 text-primary" /><h3 className="font-semibold">Voting Rewards</h3></div>
      {!hasVoted && <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg"><p className="text-sm text-destructive">You must vote or set a proxy to earn rewards.</p></div>}
      {hasVoted && (
        <>
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Last Voter Claim:</span><span className="font-medium">{formatDate(lastClaimTime)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Next Voter Claim:</span><span className={`font-medium ${nextClaimTime === 'Now!' ? 'text-green-500' : ''}`}>{nextClaimTime}</span></div>
            {proxyName && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Voting Proxy:</span><span className="font-medium">{proxyName}</span></div>}
            {producerCount > 0 && <div className="text-sm"><span className="text-muted-foreground">Voting for:</span><span className="font-medium ml-2">{producerCount} producers</span></div>}
          </div>
          <div className="p-3 bg-muted/30 rounded-lg text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Staked for Voting:</span><span className="font-medium">{stakedAmount.toFixed(8)} WAX</span></div></div>
          <Button onClick={handleClaimVote} disabled={isTransacting || !hasVoted || !canClaim} className={cn("w-full text-primary-foreground", canClaim ? "bg-primary hover:bg-primary/90" : "bg-primary/50 cursor-not-allowed")}>
            {isTransacting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Claiming...</> : <><Gift className="mr-2 h-4 w-4" />Claim Vote Rewards</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Rewards are added to your liquid WAX balance.</p>
        </>
      )}
      <Button variant="outline" onClick={fetchVoterData} disabled={isLoading} className="w-full">
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Refreshing...</> : 'Refresh Rewards'}
      </Button>
    </div>
  );
}
