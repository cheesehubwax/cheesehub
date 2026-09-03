// CHEESEAir — the holder list with per-account selection and the computed payout.
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { cn } from '@/lib/utils';
import { formatUnits } from '@/lib/airdrop';
import { useAirdrop } from './AirdropContext';

const QUICK = [10, 50, 100];
const MAX_ROWS = 500;

export function AirHoldersTable() {
  const {
    filteredHolders,
    selected,
    toggle,
    quickSelect,
    snapshot,
    snapshotMode,
    isNft,
    sendSymbol,
    recipients,
    nftAssignments,
    precision,
  } = useAirdrop();

  const amountByAccount = useMemo(
    () => new Map(recipients.map((r) => [r.account, r.units])),
    [recipients],
  );
  const assetByAccount = useMemo(
    () => new Map(nftAssignments.map((a) => [a.account, a.assetId])),
    [nftAssignments],
  );

  return (
    <Card className="border-cheese/20 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <OpenMojiIcon emoji="👥" size={18} />
            Holders{' '}
            <span className="font-mono text-cheese">
              {selected.size.toLocaleString()} / {filteredHolders.length.toLocaleString()}
            </span>
          </h2>
          <div className="flex flex-wrap gap-1">
            {QUICK.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => quickSelect(n)}
                disabled={filteredHolders.length === 0}
                className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-cheese disabled:opacity-40"
              >
                Top {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => quickSelect('all')}
              disabled={filteredHolders.length === 0}
              className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-cheese disabled:opacity-40"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => quickSelect('none')}
              disabled={filteredHolders.length === 0}
              className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-cheese disabled:opacity-40"
            >
              None
            </button>
          </div>
        </div>

        {snapshot ? (
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-secondary">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Account</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    {snapshotMode === 'nft' ? 'NFTs' : 'Balance'}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    {isNft
                      ? 'Receives (NFT)'
                      : isRam
                        ? `Spends (${CHEESE_SYMBOL})`
                        : `Receives (${sendSymbol.toUpperCase()})`}

                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHolders.slice(0, MAX_ROWS).map((h, i) => {
                  const isSelected = selected.has(h.account);
                  const units = amountByAccount.get(h.account);
                  const assetId = assetByAccount.get(h.account);
                  return (
                    <tr
                      key={h.account}
                      className={cn(
                        'border-t border-border/50 font-mono',
                        isSelected ? 'bg-cheese/5' : 'opacity-60',
                      )}
                    >
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggle(h.account)}
                            aria-label={`Include ${h.account}`}
                          />
                          <span className="text-xs text-muted-foreground">{i + 1}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-foreground">{h.account}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">
                        {snapshotMode === 'nft'
                          ? h.raw
                          : parseFloat(h.raw).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                      </td>
                      <td className="px-3 py-1.5 text-right text-cheese">
                        {isNft
                          ? (assetId ?? '—')
                          : units !== undefined
                            ? formatUnits(units, precision)
                            : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredHolders.length > MAX_ROWS && (
              <p className="bg-secondary px-3 py-2 text-xs text-muted-foreground">
                Showing first {MAX_ROWS} rows — all {filteredHolders.length.toLocaleString()}{' '}
                selected accounts are still included in the drop.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Load a holder list to preview recipients.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
