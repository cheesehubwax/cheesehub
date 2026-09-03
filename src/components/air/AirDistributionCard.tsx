// CHEESEAir — step 3: how much every recipient gets, plus memo and batching.
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { cn } from '@/lib/utils';
import type { DistributionMode } from '@/lib/airdrop';
import { CHEESE_SYMBOL } from '@/lib/airdropCheese';
import { formatCheese } from '@/lib/airdropResources';
import { useAirdrop } from './AirdropContext';


const MODES: Array<[DistributionMode, string]> = [
  ['equal', 'Equal split'],
  ['fixed', 'Fixed each'],
  ['prorata', 'Pro-rata'],
];

export function AirDistributionCard() {
  const {
    isNft,
    isRam,
    ramUnit,
    setRamUnit,
    mode,
    setMode,
    amountText,
    setAmountText,
    sendSymbol,
    snapshot,
    memo,
    setMemo,
    batchSize,
    setBatchSize,
    minWeight,
    setMinWeight,
  } = useAirdrop();

  return (
    <Card className="border-cheese/20 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <OpenMojiIcon emoji="⚖️" size={18} />
          3 · Distribution
        </h2>

        {isRam ? (
          <>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
              {MODES.map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={m === 'prorata' && snapshot !== null && !snapshot.hasBalances}
                  className={cn(
                    'rounded px-2 py-1 text-sm font-medium transition-colors disabled:opacity-40',
                    mode === m
                      ? 'bg-cheese/20 text-cheese'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1">
              {(['cheese', 'kb'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setRamUnit(u)}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium transition-colors',
                    ramUnit === u
                      ? 'bg-cheese/20 text-cheese'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Enter in {u === 'cheese' ? CHEESE_SYMBOL : 'KB of RAM'}
                </button>
              ))}
            </div>
            <div className="mb-2">
              <Label className="mb-1 block text-xs text-muted-foreground">
                {mode === 'fixed'
                  ? `Amount per holder (${ramUnit === 'cheese' ? CHEESE_SYMBOL : 'KB'})`
                  : `Total amount (${ramUnit === 'cheese' ? CHEESE_SYMBOL : 'KB'})`}
              </Label>
              <Input
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder={ramUnit === 'cheese' ? 'e.g. 25.0000' : 'e.g. 30'}
                className="font-mono"
              />
              {ramExcluded.belowMin > 0 && (
                <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
                  <p className="text-xs text-destructive">
                    {ramExcluded.belowMin.toLocaleString()} of {selectedCount.toLocaleString()}{' '}
                    selected holders get less than the{' '}
                    {ramLimits ? formatCheese(ramLimits.minCheese) : '—'} {CHEESE_SYMBOL} minimum per
                    RAM purchase and are skipped.
                    {ramMinViable
                      ? ` Enter at least ${ramMinViable.text} ${ramUnit === 'cheese' ? CHEESE_SYMBOL : 'KB'} to include all ${selectedCount.toLocaleString()}, or reduce the selection.`
                      : ' Some selected holders have no balance, so a pro-rata split can never reach the minimum for them.'}
                  </p>
                  {ramMinViable && (
                    <button
                      type="button"
                      onClick={applyRamMinViable}
                      className="mt-2 rounded border border-cheese/40 bg-cheese/10 px-2 py-1 text-xs font-medium text-cheese transition-colors hover:bg-cheese/20"
                    >
                      Raise to minimum viable total
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="mb-2 rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
              RAM purchases carry the recipient&apos;s account name in the memo, so the memo field is
              not used in RAM mode. KB entries are converted to {CHEESE_SYMBOL} at the live price with
              a small safety margin.
            </p>
          </>
        ) : isNft ? (
          <p className="mb-3 rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
            Each selected recipient receives exactly 1 NFT of the chosen template, assigned in
            inventory order (lowest asset id first).
          </p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
              {MODES.map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={m === 'prorata' && snapshot !== null && !snapshot.hasBalances}
                  className={cn(
                    'rounded px-2 py-1 text-sm font-medium transition-colors disabled:opacity-40',
                    mode === m
                      ? 'bg-cheese/20 text-cheese'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mb-2">
              <Label className="mb-1 block text-xs text-muted-foreground">
                {mode === 'fixed'
                  ? `Amount per holder (${sendSymbol.toUpperCase()})`
                  : `Total amount (${sendSymbol.toUpperCase()})`}
              </Label>
              <Input
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder={mode === 'fixed' ? 'e.g. 5.0000' : 'e.g. 10000.0000'}
                className="font-mono"
              />
            </div>
          </>
        )}

        <div className={cn('mb-2', isRam && 'hidden')}>
          <Label className="mb-1 block text-xs text-muted-foreground">Memo</Label>
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={256}
            className="font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Batch size (actions/tx)
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 15)}
              className="font-mono"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Min. balance to include
            </Label>
            <Input
              value={minWeight}
              onChange={(e) => setMinWeight(e.target.value)}
              placeholder="0"
              className="font-mono"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
