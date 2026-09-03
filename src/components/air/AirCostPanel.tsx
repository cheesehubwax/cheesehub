// CHEESEAir — summary and the CHEESE cost of the resources this drop needs.
import { Card, CardContent } from '@/components/ui/card';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { formatUnits, RAM_BYTES_PER_NFT } from '@/lib/airdrop';
import { formatCheese } from '@/lib/airdropResources';
import { CHEESE_SYMBOL, MIN_RAM_PURCHASE_CHEESE } from '@/lib/airdropCheese';
import { RAM_BYTES_PER_ROW, useAirdrop } from './AirdropContext';

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

export function AirCostPanel() {
  const {
    actor,
    isNft,
    recipientCount,
    total,
    precision,
    sendSymbol,
    estimate,
    nftAssignments,
    rowStats,
    rowCheckLoading,
    recipients,
    estCpuCheese,
    estRamCheese,
    cheesePerCpuMs,
    cheesePerRamKb,
    requiredRamCheese,
    suggestedCpuCheese,
    cheeseBalance,
  } = useAirdrop();

  // CPU pricing is calibrated from the connected account's own stake weight.
  const unavailable = actor ? 'unavailable' : 'connect wallet';

  return (
    <Card className="border-cheese/20 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <OpenMojiIcon emoji="🧾" size={18} />
          Summary
        </h2>

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Recipients</dt>
            <dd className="font-mono text-lg text-foreground">
              {recipientCount.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total to send</dt>
            <dd className="font-mono text-lg text-cheese">
              {isNft
                ? `${nftAssignments.length.toLocaleString()} NFT${nftAssignments.length === 1 ? '' : 's'}`
                : `${formatUnits(total, precision)} ${sendSymbol.toUpperCase()}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Transactions</dt>
            <dd className="font-mono text-lg text-foreground">{estimate.txCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Est. total CPU</dt>
            <dd className="font-mono text-lg text-foreground">
              ~{(estimate.totalCpuUs / 1000).toFixed(0)} ms
            </dd>
          </div>
        </dl>

        <div className="rounded-md border border-cheese/20 bg-background/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resource cost in {CHEESE_SYMBOL} (estimate)
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <Metric
              label="CPU/NET for this drop"
              value={
                estCpuCheese !== null
                  ? `~${formatCheese(estCpuCheese)} ${CHEESE_SYMBOL}`
                  : unavailable
              }
            />
            <Metric
              label="RAM for this drop"
              value={
                estRamCheese !== null
                  ? `~${formatCheese(estRamCheese)} ${CHEESE_SYMBOL}`
                  : unavailable
              }
              sub={
                isNft
                  ? `~${((estimate.maxNewRows * RAM_BYTES_PER_NFT) / 1024).toFixed(2)} KB for ${nftAssignments.length} NFT transfer${nftAssignments.length === 1 ? '' : 's'}`
                  : rowCheckLoading
                    ? 'checking existing token rows…'
                    : rowStats.complete
                      ? `${estimate.maxNewRows} of ${recipients.length} need a new row (${((estimate.maxNewRows * RAM_BYTES_PER_ROW) / 1024).toFixed(2)} KB)`
                      : `upper bound: assumes all ${recipients.length} need a new row`
              }
            />
            <Metric
              label="CPU price"
              value={
                cheesePerCpuMs !== null
                  ? `${formatCheese(cheesePerCpuMs)} ${CHEESE_SYMBOL} / ms`
                  : unavailable
              }
            />
            <Metric
              label="RAM price"
              value={
                cheesePerRamKb !== null
                  ? `${formatCheese(cheesePerRamKb)} ${CHEESE_SYMBOL} / KB`
                  : unavailable
              }
            />
          </dl>

          <p className="mt-3 text-xs text-foreground">
            RAM purchase (required):{' '}
            {requiredRamCheese !== null
              ? `${formatCheese(requiredRamCheese)} ${CHEESE_SYMBOL}`
              : unavailable}{' '}
            — every airdrop buys at least {formatCheese(MIN_RAM_PURCHASE_CHEESE)} {CHEESE_SYMBOL} of
            RAM. The excess RAM stays in your account and can be sold again afterwards.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            CPU/NET is topped up only if you are short
            {suggestedCpuCheese !== null
              ? ` — about ${formatCheese(suggestedCpuCheese)} ${CHEESE_SYMBOL} right now.`
              : ' — your account currently has enough CPU and NET.'}
            {requiredRamCheese !== null
              ? ` Total to sign: ~${formatCheese(requiredRamCheese + (suggestedCpuCheese ?? 0))} ${CHEESE_SYMBOL}.`
              : ''}
            {cheeseBalance !== null
              ? ` Your balance: ${formatCheese(cheeseBalance)} ${CHEESE_SYMBOL}.`
              : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
