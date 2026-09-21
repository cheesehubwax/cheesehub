import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info, Loader2, Recycle } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { toast } from 'sonner';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { TokenLogo } from '@/components/TokenLogo';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { Checkbox } from '@/components/ui/checkbox';
import { buildClaimRewardsAction, buildIncreaseLiquidityAction, fetchPoolSlot, AlcorFarmPosition } from '@/lib/alcorFarms';
import type { PoolSlot } from '@/lib/alcorV3Amounts';
import { waxRpcCall } from '@/lib/waxRpcFallback';
import {
  AvailableBalance,
  COMPOUND_FEE_ACCOUNT,
  COMPOUND_SLIPPAGE_TOLERANCE,
  COMPOUND_FEE_MEMO,
  CompoundCandidate,
  CompoundPlan,
  MAX_COMPOUND_POSITIONS,
  balanceKey,
  buildBalanceReadList,
  buildClaimedBalances,
  buildCompoundFeeTotals,
  paysBothTokens,
  planCompound,
} from '@/lib/alcorCompound';

export interface CompoundPosition {
  positionId: number;
  poolId: number;
  tickLower: number;
  tickUpper: number;
  tokenA: { contract: string; symbol: string; amount: number };
  tokenB: { contract: string; symbol: string; amount: number };
  usdValue: number;
  incentives: AlcorFarmPosition[];
}

interface CompoundAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: CompoundPosition[];
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
  onTransactionComplete?: () => void;
}

type Stage = 'confirm' | 'claiming' | 'waiting' | 'preview' | 'compounding' | 'done';

const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 2000;
/**
 * How long a successful claim stays usable. Reopening the dialog inside this
 * window reuses that claim instead of claiming again — a repeat claim only pays
 * a few seconds' worth of dust and costs another signature.
 */
const CLAIM_REUSE_WINDOW_MS = 15 * 60 * 1000;

interface RecentClaim {
  account: string;
  txId: string | null;
  at: number;
  before: Map<string, AvailableBalance>;
}

let recentClaim: RecentClaim | null = null;

function recordClaim(account: string, txId: string | null, before: Map<string, AvailableBalance>) {
  recentClaim = { account, txId, at: Date.now(), before };
}

function recentClaimFor(account: string): RecentClaim | null {
  if (!recentClaim || recentClaim.account !== account) return null;
  if (Date.now() - recentClaim.at > CLAIM_REUSE_WINDOW_MS) return null;
  return recentClaim;
}

/** Forget the stored claim once its rewards have been compounded. */
function clearRecentClaim() {
  recentClaim = null;
}


function parseBalance(raw: string | undefined): AvailableBalance {
  if (!raw) return { balance: 0, precision: 8, known: true };
  const [amountStr] = raw.split(' ');
  const decimals = amountStr.split('.')[1]?.length ?? 0;
  return { balance: parseFloat(amountStr) || 0, precision: decimals, known: true };
}

async function readBalance(
  account: string,
  contract: string | undefined,
  symbol: string,
): Promise<AvailableBalance> {
  // Without an issuing contract the chain cannot answer — report it as unknown
  // rather than pretending the wallet holds nothing.
  if (!contract) return { balance: 0, precision: 8, known: false };
  try {
    const rows = await waxRpcCall<string[] | undefined>(
      '/v1/chain/get_currency_balance',
      { code: contract, account, symbol },
      6000,
    );
    if (!Array.isArray(rows)) return { balance: 0, precision: 8, known: false };
    return parseBalance(rows[0]);
  } catch {
    return { balance: 0, precision: 8, known: false };
  }
}

async function readBalances(
  account: string,
  tokens: Array<{ contract?: string; symbol: string }>,
): Promise<Map<string, AvailableBalance>> {
  const map = new Map<string, AvailableBalance>();
  const results = await Promise.all(tokens.map(t => readBalance(account, t.contract, t.symbol)));
  tokens.forEach((t, i) => {
    const key = balanceKey(t.contract ?? '', t.symbol);
    const existing = map.get(key);
    const value = results[i];
    // Keep the largest reported precision if the same token appears twice.
    if (!existing || value.precision > existing.precision) {
      map.set(key, value);
    }
  });
  return map;
}

/**
 * Read the live price slot of each pool. The deposit must be sized at the exact
 * ratio the pool accepts, otherwise Alcor rejects it with "Price slippage check".
 */
async function readPoolSlots(poolIds: number[]): Promise<Map<number, PoolSlot | null>> {
  const unique = Array.from(new Set(poolIds));
  const slots = await Promise.all(
    unique.map(async id => {
      try {
        return await fetchPoolSlot(id);
      } catch {
        return null;
      }
    }),
  );
  const map = new Map<number, PoolSlot | null>();
  unique.forEach((id, i) => map.set(id, slots[i]));
  return map;
}


export function CompoundAllDialog({
  open,
  onOpenChange,
  positions,
  onTransactionSuccess,
  onTransactionComplete,
}: CompoundAllDialogProps) {
  const { session, accountName } = useWax();
  const [stage, setStage] = useState<Stage>('confirm');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [plan, setPlan] = useState<CompoundPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimTxId, setClaimTxId] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  // Balances read immediately before the claim — the baseline the claim delta is
  // measured against.
  const [beforeBalances, setBeforeBalances] = useState<Map<string, AvailableBalance>>(new Map());
  // Positions the user unticked in the preview. Keyed by position ID so a
  // re-check that produces the same plan keeps their choices.
  const [deselectedIds, setDeselectedIds] = useState<Set<number>>(new Set());

  // Balances read after the claim — kept so the plan can be rebuilt against
  // fresh pool prices immediately before signing.
  const [afterBalances, setAfterBalances] = useState<Map<string, AvailableBalance>>(new Map());
  // True once rewards have been claimed in this flow, so the claim can never run
  // a second time (a repeat claim only pays dust and costs another signature).
  const [claimed, setClaimed] = useState(false);
  const [reusedClaim, setReusedClaim] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTermsAccepted(false);
    setError(null);
    setRechecking(false);
    setDeselectedIds(new Set());
    setAfterBalances(new Map());

    // A claim that already happened moments ago (dialog closed and reopened)
    // must not be repeated — reuse its baseline and go straight to planning.
    const recent = accountName ? recentClaimFor(accountName) : null;
    if (recent) {
      setStage('waiting');
      setPlan(null);
      setClaimTxId(recent.txId);
      setClaimed(true);
      setReusedClaim(true);
      setBeforeBalances(recent.before);
      return;
    }

    setStage('confirm');
    setPlan(null);
    setClaimTxId(null);
    setClaimed(false);
    setReusedClaim(false);
    setBeforeBalances(new Map());
  }, [open, accountName]);



  const candidates = useMemo<CompoundCandidate[]>(
    () =>
      positions.map(pos => ({
        positionId: pos.positionId,
        poolId: pos.poolId,
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
        tokenA: pos.tokenA,
        tokenB: pos.tokenB,
        usdValue: pos.usdValue,
        rewardTokenKeys: Array.from(
          new Set(pos.incentives.map(i => balanceKey(i.rewardToken.contract, i.rewardToken.symbol))),
        ),
      })),
    [positions],
  );

  // Positions whose farms pay out both pool tokens — the ones that can compound.
  const eligibleCandidates = useMemo(
    () => candidates.filter(c => paysBothTokens(c.rewardTokenKeys, c.tokenA, c.tokenB)),
    [candidates],
  );

  // Read balances for every token involved: reward tokens plus the pool's own
  // tokens, with the static registry filling in any missing contract. A reward
  // record without a contract would otherwise produce a failed read.
  const tokensToRead = useMemo(() => buildBalanceReadList(eligibleCandidates), [eligibleCandidates]);

  const claims = useMemo(() => {
    const map = new Map<string, { incentiveId: number; posId: number }>();
    positions.forEach(pos => {
      pos.incentives.forEach(i => {
        map.set(`${i.incentiveId}-${i.positionId}`, { incentiveId: i.incentiveId, posId: i.positionId });
      });
    });
    return Array.from(map.values());
  }, [positions]);

  // Attach the live pool price to each candidate right before planning.
  const withSlots = useCallback(async (): Promise<CompoundCandidate[]> => {
    const slots = await readPoolSlots(eligibleCandidates.map(c => c.poolId));
    return candidates.map(c => ({ ...c, slot: slots.get(c.poolId) ?? null }));
  }, [candidates, eligibleCandidates]);


  const runClaimAndPlan = useCallback(async () => {
    if (!session || !accountName) return;
    // Never claim twice in one flow.
    if (claimed) return;
    setError(null);


    // Balances before the claim: everything here belongs to the user already and
    // must never be compounded.
    let before: Map<string, AvailableBalance>;
    try {
      before = await readBalances(accountName, tokensToRead);
    } catch {
      before = new Map();
    }
    setBeforeBalances(before);

    setStage('claiming');
    let txId: string | null = null;
    try {
      const result = await session.transact(
        { actions: buildClaimRewardsAction(accountName, claims) },
        { transactPlugins: getTransactPlugins(session) },
      );
      txId = result.resolved?.transaction.id?.toString() || null;
      setClaimTxId(txId);
      setClaimed(true);
      recordClaim(accountName, txId, before);

    } catch (err: any) {
      setStage('confirm');
      setError(err?.message || 'Failed to claim rewards. Nothing was compounded.');
      closeWharfkitModals();
      return;
    }
    closeWharfkitModals();

    setStage('waiting');
    let after = before;
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS));
      after = await readBalances(accountName, tokensToRead);
      const increased = Array.from(after.entries()).some(([key, value]) => {
        const prev = before.get(key)?.balance ?? 0;
        return value.balance > prev;
      });
      if (increased) break;
    }

    // Only the claim delta is available to compound, sized at the live pool ratio.
    setAfterBalances(after);
    const built = planCompound(await withSlots(), buildClaimedBalances(before, after), MAX_COMPOUND_POSITIONS);
    setPlan(built);
    // Fresh claim — everything compoundable starts selected.
    setDeselectedIds(new Set());
    setStage('preview');
    onTransactionComplete?.();
  }, [session, accountName, claimed, tokensToRead, claims, withSlots, onTransactionComplete]);


  // Re-read balances and rebuild the plan without claiming again — recovery for
  // a balance read that failed the first time round. Still measured against the
  // pre-claim snapshot, so re-checking never widens what can be spent.
  const recheckBalances = useCallback(async () => {
    if (!accountName) return;
    setError(null);
    setRechecking(true);
    try {
      const [after, candidatesWithSlots] = await Promise.all([
        readBalances(accountName, tokensToRead),
        withSlots(),
      ]);
      setAfterBalances(after);
      const built = planCompound(
        candidatesWithSlots,
        buildClaimedBalances(beforeBalances, after),
        MAX_COMPOUND_POSITIONS,
      );
      setPlan(built);

      // Keep the user's unticked positions, but drop any no longer in the plan.
      const stillCompoundable = new Set(built.compoundable.map(e => e.positionId));
      setDeselectedIds(prev => new Set([...prev].filter(id => stillCompoundable.has(id))));
      if (
        built.compoundable.length === 0 &&
        built.skipped.every(s => s.reason === 'balance-unknown' || s.reason === 'pool-price-unknown')
      ) {
        setError('Still could not read your balances or the pool prices. Your rewards are safe in your wallet — try again in a moment.');
      }
    } catch {
      setError('Could not read your balances just now. Your rewards are safe in your wallet — try again in a moment.');
    } finally {
      setRechecking(false);
    }
  }, [accountName, tokensToRead, withSlots, beforeBalances]);

  // Reopened with rewards claimed moments ago: plan against that claim instead of
  // claiming again.
  useEffect(() => {
    if (!open || !reusedClaim || stage !== 'waiting' || plan) return;
    let cancelled = false;
    (async () => {
      await recheckBalances();
      if (!cancelled) setStage('preview');
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reusedClaim, stage, plan, recheckBalances]);





  const selectedEntries = useMemo(
    () => (plan ? plan.compoundable.filter(e => !deselectedIds.has(e.positionId)) : []),
    [plan, deselectedIds],
  );

  const runCompound = useCallback(async () => {
    if (!session || !accountName || selectedEntries.length === 0) return;
    setError(null);
    setStage('compounding');
    try {
      // Re-size the deposits against the pool prices as they are right now. The
      // price moves with every trade, and a plan built even a minute ago can be
      // off the pool's current ratio, which is what the pool rejects.
      const fresh = planCompound(
        await withSlots(),
        buildClaimedBalances(beforeBalances, afterBalances),
        MAX_COMPOUND_POSITIONS,
      );
      const selectedIds = new Set(selectedEntries.map(e => e.positionId));
      const entries = fresh.compoundable.filter(e => selectedIds.has(e.positionId));
      if (entries.length === 0) {
        setStage('preview');
        setPlan(fresh);
        const reasons = fresh.skipped
          .filter(s => selectedIds.has(s.positionId))
          .map(s => `${s.pair} #${s.positionId} — ${s.detail}`);
        setError(
          reasons.length > 0
            ? `The pool prices moved, so these deposits can no longer be made: ${reasons.join('; ')}. Your rewards are safe in your wallet.`
            : 'The pool prices moved and nothing could be deposited. Your rewards are safe in your wallet — press "Re-check balances" and try again.',
        );
        return;
      }
      setPlan(fresh);
      const feeActions = buildCompoundFeeTotals(entries).map(fee => ({
        account: fee.contract,
        name: 'transfer',
        authorization: [{ actor: accountName, permission: 'active' }],
        data: {
          from: accountName,
          to: COMPOUND_FEE_ACCOUNT,
          quantity: fee.quantity,
          memo: COMPOUND_FEE_MEMO,
        },
      }));
      const depositActions = entries.flatMap(entry =>
        buildIncreaseLiquidityAction(
          accountName,
          entry.positionId,
          entry.poolId,
          entry.tickLower,
          entry.tickUpper,
          entry.tokenA.contract,
          entry.tokenA.quantity,
          entry.tokenB.contract,
          entry.tokenB.quantity,
          COMPOUND_SLIPPAGE_TOLERANCE,
        ),
      );
      const actions = [...feeActions, ...depositActions];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.(
        'Rewards Compounded!',
        `Added rewards back into ${entries.length} position${entries.length !== 1 ? 's' : ''}`,
        txId,
      );
      clearRecentClaim();
      setStage('done');
      onTransactionComplete?.();
      onOpenChange(false);
    } catch (err: any) {
      setStage('preview');
      const raw = err?.message || 'Failed to add liquidity';
      const slippage = /slippage/i.test(raw);
      const names = selectedEntries.map(e => `${e.pair} #${e.positionId}`).join(', ');
      setError(
        slippage
          ? `The pool price moved while you were signing, so the deposit was rejected (${names}). Your rewards are safe in your wallet — press "Re-check balances" and try again. If one pair keeps failing, untick it and compound the rest.`
          : `${raw} — your rewards were already claimed and are safe in your wallet. You can retry the compound step.`,
      );
    } finally {
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [
    session,
    accountName,
    selectedEntries,
    withSlots,
    beforeBalances,
    afterBalances,
    onTransactionSuccess,
    onTransactionComplete,
    onOpenChange,
  ]);


  const busy = stage === 'claiming' || stage === 'waiting' || stage === 'compounding';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-cheese" />
            Compound All Rewards
          </DialogTitle>
          <DialogDescription>
            Claim your farm rewards, then put them straight back into the same pools.
          </DialogDescription>
        </DialogHeader>

        {stage === 'confirm' && (
          <div className="space-y-4">
            <Alert className="bg-muted/40">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-1">
                <p>
                  Step 1 claims rewards from {claims.length} farm{claims.length !== 1 ? 's' : ''}. Step 2 adds them back
                  into up to {MAX_COMPOUND_POSITIONS} positions in one transaction.
                </p>
                <p>
                  Only pools whose rewards cover both tokens can be compounded ({eligibleCandidates.length} of{' '}
                  {candidates.length} position{candidates.length !== 1 ? 's' : ''}), and the position must still be
                  inside its price range. Deposits are sized at the exact ratio the pool accepts, so the smaller reward
                  side goes in as far as it can and anything left over stays in your wallet.
                </p>
                <p>
                  Only the tokens this claim pays out are used — tokens already in your wallet are never spent. A 0.75%
                  fee on each deposit is sent to {COMPOUND_FEE_ACCOUNT}.
                </p>
              </AlertDescription>
            </Alert>

            {eligibleCandidates.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  None of your farms pay out both tokens of their pool, so nothing can be compounded right now. Use
                  Claim All instead.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <TermsCheckbox id="compound-terms" checked={termsAccepted} onCheckedChange={setTermsAccepted} />

            <Button
              className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
              disabled={!termsAccepted || eligibleCandidates.length === 0 || !session}
              onClick={runClaimAndPlan}
            >
              Claim &amp; Continue
            </Button>
          </div>
        )}

        {(stage === 'claiming' || stage === 'waiting') && (
          <div className="py-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-cheese" />
            {stage === 'claiming' ? 'Waiting for your claim signature…' : 'Rewards claimed — checking your balances…'}
          </div>
        )}

        {(stage === 'preview' || stage === 'compounding') && plan && (
          <div className="space-y-4">
            {plan.compoundable.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 px-1">
                  <Checkbox
                    id="compound-select-all"
                    checked={selectedEntries.length === plan.compoundable.length}
                    onCheckedChange={(checked) => {
                      setDeselectedIds(
                        checked === true
                          ? new Set()
                          : new Set(plan.compoundable.map(e => e.positionId)),
                      );
                    }}
                    disabled={stage === 'compounding'}
                  />
                  <label htmlFor="compound-select-all" className="text-xs text-muted-foreground cursor-pointer">
                    {selectedEntries.length} of {plan.compoundable.length} selected
                  </label>
                </div>
                {plan.compoundable.map(entry => {
                  const isSelected = !deselectedIds.has(entry.positionId);
                  return (
                    <div
                      key={entry.positionId}
                      className={`flex items-center justify-between gap-2 rounded-md border p-2 ${
                        isSelected ? 'border-border/50 bg-muted/30' : 'border-border/30 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`compound-entry-${entry.positionId}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setDeselectedIds(prev => {
                              const next = new Set(prev);
                              if (checked === true) next.delete(entry.positionId);
                              else next.add(entry.positionId);
                              return next;
                            });
                          }}
                          disabled={stage === 'compounding'}
                        />
                        <label htmlFor={`compound-entry-${entry.positionId}`} className="flex items-center gap-2 cursor-pointer">
                          <div className="flex -space-x-2">
                            <TokenLogo contract={entry.tokenA.contract} symbol={entry.tokenA.symbol} size="sm" />
                            <TokenLogo contract={entry.tokenB.contract} symbol={entry.tokenB.symbol} size="sm" />
                          </div>
                          <div className="text-xs">
                            <div className="font-medium">{entry.tokenA.symbol}/{entry.tokenB.symbol}</div>
                            <div className="text-muted-foreground">#{entry.positionId}</div>
                          </div>
                        </label>
                      </div>
                      <div className="font-mono text-xs text-right text-cheese">
                        <div>{entry.tokenA.amount.toFixed(Math.min(6, entry.tokenA.precision))} {entry.tokenA.symbol}</div>
                        <div>{entry.tokenB.amount.toFixed(Math.min(6, entry.tokenB.precision))} {entry.tokenB.symbol}</div>
                        {(entry.tokenA.fee > 0 || entry.tokenB.fee > 0) && (
                          <div className="text-[10px] text-muted-foreground">
                            fee {entry.tokenA.fee.toFixed(Math.min(6, entry.tokenA.precision))} {entry.tokenA.symbol}
                            {entry.tokenB.fee > 0 && (
                              <> · {entry.tokenB.fee.toFixed(Math.min(6, entry.tokenB.precision))} {entry.tokenB.symbol}</>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground">
                  Only the rewards from this claim are used — tokens you already held are never touched. 0.75% of each
                  deposit supports HOLE. Pool prices move constantly, so the pool may use a little less than shown;
                  any small remainder is credited to your Alcor balance and can be withdrawn there.
                </p>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Your rewards were claimed, but nothing could be paired up for a deposit. The rewards are in your
                  wallet.
                </AlertDescription>
              </Alert>
            )}

            {plan.skipped.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto pr-1">
                <p className="font-medium text-foreground">Skipped ({plan.skipped.length})</p>
                {plan.skipped.map(skip => (
                  <p key={`${skip.positionId}-${skip.reason}`}>
                    {skip.pair} #{skip.positionId} — {skip.detail}
                  </p>
                ))}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={stage === 'compounding' || rechecking}
              onClick={recheckBalances}
            >
              {rechecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Re-check balances'}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={stage === 'compounding'}
                onClick={() => {
                  if (claimTxId) {
                    onTransactionSuccess?.(
                      'Rewards Claimed!',
                      `Claimed rewards from ${claims.length} incentive(s)`,
                      claimTxId,
                    );
                  } else {
                    toast.success('Rewards claimed');
                  }
                  onOpenChange(false);
                }}
              >
                Keep rewards
              </Button>
              <Button
                className="flex-1 bg-cheese hover:bg-cheese-dark text-primary-foreground"
                disabled={stage === 'compounding' || selectedEntries.length === 0}
                onClick={runCompound}
              >
                {stage === 'compounding' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Add to ${selectedEntries.length} position${selectedEntries.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
