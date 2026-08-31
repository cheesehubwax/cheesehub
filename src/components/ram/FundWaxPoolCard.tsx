import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { useTransactionSuccess } from '@/context/TransactionSuccessContext';
import { useCheeseRamVoteRewards } from '@/hooks/useCheeseRamVoteRewards';
import { closeWharfkitModals, getTransactPlugins, parseTransactError } from '@/lib/wharfKit';
import { CHEESE_RAM_CONTRACT } from '@/lib/cheeseRam';
import waxLogoUrl from '@/assets/wax-seal.png';

interface FundWaxPoolCardProps {
  onComplete?: () => void;
}

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
};

export function FundWaxPoolCard({ onComplete }: FundWaxPoolCardProps) {
  const { session, isConnected, login } = useWax();
  const { showSuccess } = useTransactionSuccess();
  const { data, refetch } = useCheeseRamVoteRewards();
  const [isTransacting, setIsTransacting] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick every second so the claimable estimate accrues live.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (data) setJustClaimed(false);
  }, [data?.sampledAt]);

  const elapsedSecs = data ? Math.max(0, (now - data.sampledAt) / 1000) : 0;
  const claimable = justClaimed
    ? 0
    : data
      ? Math.max(0, data.claimable + data.perSecond * elapsedSecs)
      : 0;

  const cooldownRemaining = data?.nextClaimTime ? Math.max(0, data.nextClaimTime - now) : 0;
  const onCooldown = cooldownRemaining > 0;
  const hasRewards = claimable > 0;
  const canClaim = isConnected && !isTransacting && !onCooldown && hasRewards;


  const handleClaim = async () => {
    if (!isConnected || !session) {
      await login();
      return;
    }
    if (!canClaim) return;

    setIsTransacting(true);
    try {
      const result = await session.transact(
        {
          actions: [
            {
              account: CHEESE_RAM_CONTRACT,
              name: 'claimvotes',
              authorization: [session.permissionLevel],
              data: { caller: session.permissionLevel.actor.toString() },
            },
          ],
        },
        { transactPlugins: getTransactPlugins(session) },
      );
      const txId = result.resolved?.transaction.id?.toString() ?? null;
      if (!txId) {
        toast.error('Transaction may not have confirmed', {
          description: 'Please check the contract account on waxblock.io.',
          duration: 10000,
        });
        return;
      }

      setJustClaimed(true);
      showSuccess(
        'WAX Pool Funded!',
        `Claimed ~${claimable.toFixed(2)} WAX of voting rewards into the ${CHEESE_RAM_CONTRACT} liquid WAX pool.`,
        txId,
      );
      refetch();
      onComplete?.();
    } catch (error) {
      console.error('[CHEESERam] Claim votes failed:', error);
      const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (raw.includes('missing authority')) {
        toast.error('Claim not available yet', {
          description:
            'Only the contract admin can claim the voting rewards right now. Rewards are also claimed automatically whenever someone buys RAM.',
          duration: 10000,
        });
        return;
      }
      const info = parseTransactError(error);
      if (info.type !== 'cancelled') {
        toast.error(info.title, { description: info.description, duration: info.duration });
      }
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-card/50 border border-border/50 px-4 py-2">
      <img src={waxLogoUrl} alt="WAX" className="w-6 h-6 object-contain" />
      <div className="text-left">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fund WAX Pool</p>
        <p className="text-sm font-bold font-mono text-foreground">{claimable.toFixed(2)} WAX</p>
      </div>

      {isConnected && (

        <Button
          onClick={handleClaim}
          disabled={!canClaim}
          size="sm"
          className="ml-auto h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold disabled:opacity-40"
        >
          {isTransacting ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Claiming...
            </>
          ) : onCooldown ? (
            formatCountdown(cooldownRemaining)
          ) : !hasRewards ? (
            'No rewards'
          ) : (
            'Claim'
          )}
        </Button>
      )}
    </div>
  );
}
