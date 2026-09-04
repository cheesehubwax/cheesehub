// CHEESEAir — step 2: snapshot the holder list the drop goes to.
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterPairs, formatFee, pairLabel } from '@/lib/airdropAlcorLp';
import { ACCOUNT_RE, useAirdrop, type SnapshotMode } from './AirdropContext';

export function AirSnapshotCard() {
  const {
    snapshotMode,
    setSnapshotMode,
    snapContract,
    setSnapContract,
    snapSymbol,
    setSnapSymbol,
    snapCollection,
    setSnapCollection,
    snapSchema,
    setSnapSchema,
    snapTemplate,
    setSnapTemplate,
    lpPairs,
    lpPairsLoading,
    lpPair,
    setLpPair,
    lpPoolsScanned,
    lpPositions,
    snapshot,
    snapshotAt,
    snapshotError,
    loadSnapshot,
    busy,
  } = useAirdrop();

  const [pairOpen, setPairOpen] = useState(false);
  const [pairQuery, setPairQuery] = useState('');
  const pairMatches = useMemo(() => filterPairs(lpPairs, pairQuery), [lpPairs, pairQuery]);

  const loading = busy === 'snapshot';
  const disabled =
    loading ||
    (snapshotMode === 'token'
      ? !ACCOUNT_RE.test(snapContract) || !snapSymbol
      : snapshotMode === 'nft'
        ? !snapCollection
        : !lpPair);

  return (
    <Card className="border-cheese/20 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <OpenMojiIcon emoji="📋" size={18} />
          2 · Airdrop to holders of
        </h2>

        <Tabs value={snapshotMode} onValueChange={(v) => setSnapshotMode(v as SnapshotMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="token">Token</TabsTrigger>
            <TabsTrigger value="nft">NFT collection</TabsTrigger>
            <TabsTrigger value="lp">Alcor LP</TabsTrigger>
          </TabsList>
        </Tabs>


        {snapshotMode === 'token' ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input
              value={snapContract}
              onChange={(e) => setSnapContract(e.target.value.trim().toLowerCase())}
              placeholder="contract (e.g. cheeseburger)"
              className="font-mono"
            />
            <Input
              value={snapSymbol}
              onChange={(e) => setSnapSymbol(e.target.value.trim().toUpperCase())}
              placeholder="symbol"
              className="font-mono"
            />
          </div>
        ) : snapshotMode === 'nft' ? (
          <div className="mt-3 space-y-2">
            <Input
              value={snapCollection}
              onChange={(e) => setSnapCollection(e.target.value.trim().toLowerCase())}
              placeholder="collection name (required)"
              className="font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={snapSchema}
                onChange={(e) => setSnapSchema(e.target.value.trim())}
                placeholder="schema (optional)"
                className="font-mono"
              />
              <Input
                value={snapTemplate}
                onChange={(e) => setSnapTemplate(e.target.value.trim())}
                placeholder="template id (optional)"
                className="font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <Popover open={pairOpen} onOpenChange={setPairOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pairOpen}
                  className="w-full justify-between font-mono"
                >
                  {lpPair ? pairLabel(lpPair) : 'Select a liquidity pair'}
                  {lpPairsLoading ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-60" />
                  ) : (
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    value={pairQuery}
                    onValueChange={setPairQuery}
                    placeholder="Search pair (e.g. cheese)"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {lpPairsLoading ? 'Loading Alcor pools…' : 'No pair found.'}
                    </CommandEmpty>
                    {pairMatches.map((pair) => (
                      <CommandItem
                        key={pair.key}
                        value={pair.key}
                        onSelect={() => {
                          setLpPair(pair);
                          setPairOpen(false);
                        }}
                        className="font-mono text-xs"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            lpPair?.key === pair.key ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="flex-1">{pairLabel(pair)}</span>
                        <span className="ml-2 text-muted-foreground">
                          {pair.poolIds.length} pool{pair.poolIds.length === 1 ? '' : 's'} ·{' '}
                          {pair.fees.map(formatFee).join(', ')}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Snapshots every fee tier of the pair. Only open, in-range positions count, weighted
              by their USD value.
            </p>
          </div>
        )}

        <Button onClick={loadSnapshot} disabled={disabled} className="mt-3 w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading holders…
            </>
          ) : (
            'Load holder list'
          )}
        </Button>

        {snapshot && (
          <p className="mt-2 text-xs text-muted-foreground">
            {snapshot.holders.length.toLocaleString()}
            {snapshotMode === 'lp' ? ' liquidity providers' : ' holders'}
            {snapshot.truncated && ' (truncated)'} · via {snapshot.source}
            {snapshotMode === 'lp' && lpPoolsScanned !== null && (
              <>
                {' '}
                · {lpPoolsScanned} pool{lpPoolsScanned === 1 ? '' : 's'}
                {lpPositions !== null && ` · ${lpPositions.toLocaleString()} positions`}
              </>
            )}
            {snapshotAt && ` · ${new Date(snapshotAt).toLocaleTimeString()}`}
          </p>
        )}

        )}
        {snapshot && !snapshot.hasBalances && (
          <p className="mt-1 text-xs text-destructive">
            Fallback source has no balances — pro-rata distribution is unavailable.
          </p>
        )}
        {snapshotError && <p className="mt-2 text-xs text-destructive">{snapshotError}</p>}
      </CardContent>
    </Card>
  );
}
