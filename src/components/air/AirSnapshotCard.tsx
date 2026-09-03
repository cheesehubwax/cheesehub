// CHEESEAir — step 2: snapshot the holder list the drop goes to.
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_RE, useAirdrop } from './AirdropContext';

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
    snapshot,
    snapshotAt,
    snapshotError,
    loadSnapshot,
    busy,
  } = useAirdrop();

  const loading = busy === 'snapshot';
  const disabled =
    loading ||
    (snapshotMode === 'token' ? !ACCOUNT_RE.test(snapContract) || !snapSymbol : !snapCollection);

  return (
    <Card className="border-cheese/20 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <OpenMojiIcon emoji="📋" size={18} />
          2 · Airdrop to holders of
        </h2>

        <Tabs value={snapshotMode} onValueChange={(v) => setSnapshotMode(v as 'token' | 'nft')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="token">Token</TabsTrigger>
            <TabsTrigger value="nft">NFT collection</TabsTrigger>
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
        ) : (
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
            {snapshot.holders.length.toLocaleString()} holders
            {snapshot.truncated && ' (truncated)'} · via {snapshot.source}
            {snapshotAt && ` · ${new Date(snapshotAt).toLocaleTimeString()}`}
          </p>
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
