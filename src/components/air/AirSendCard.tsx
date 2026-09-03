// CHEESEAir — step 1: choose the token or NFT template being airdropped.
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { cn } from '@/lib/utils';
import { useAirdrop } from './AirdropContext';

export function AirSendCard() {
  const {
    assetKind,
    setAssetKind,
    isNft,
    actor,
    sendContract,
    setSendContract,
    sendSymbol,
    setSendSymbol,
    tokenStat,
    walletTokens,
    nftCollections,
    nftCollection,
    setNftCollection,
    nftTemplates,
    nftTemplateId,
    setNftTemplateId,
    nftPool,
    nftLoading,
    nftError,
  } = useAirdrop();

  return (
    <Card className="border-cheese/20 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <OpenMojiIcon emoji="📦" size={18} />
          1 · What to send
        </h2>

        <Tabs value={assetKind} onValueChange={(v) => setAssetKind(v as 'token' | 'nft')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="token">Token</TabsTrigger>
            <TabsTrigger value="nft">NFTs</TabsTrigger>
          </TabsList>
        </Tabs>

        {isNft ? (
          <div className="mt-3 space-y-3">
            {!actor ? (
              <p className="text-xs text-muted-foreground">
                Connect your wallet to load the NFTs you own.
              </p>
            ) : (
              <>
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">
                    Your collections
                    {nftLoading === 'collections' && ' · loading…'}
                  </span>
                  <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                    {nftCollections.map((c) => (
                      <button
                        key={c.collection}
                        type="button"
                        onClick={() => setNftCollection(c.collection)}
                        title={c.name}
                        className={cn(
                          'rounded border px-2 py-0.5 font-mono text-xs transition-colors',
                          c.collection === nftCollection
                            ? 'border-cheese bg-cheese/10 text-cheese'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {c.collection} ({c.assets})
                      </button>
                    ))}
                    {nftCollections.length === 0 && nftLoading === null && (
                      <span className="text-xs text-muted-foreground">
                        No NFTs found in this account.
                      </span>
                    )}
                  </div>
                </div>

                {nftCollection && (
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">
                      Template to airdrop (1 NFT per recipient)
                      {nftLoading === 'templates' && ' · loading…'}
                    </Label>
                    <select
                      value={nftTemplateId ?? ''}
                      onChange={(e) =>
                        setNftTemplateId(e.target.value ? Number(e.target.value) : null)
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-2 font-mono text-sm text-foreground"
                    >
                      <option value="">Select a template…</option>
                      {nftTemplates.map((t) => (
                        <option key={t.templateId} value={t.templateId}>
                          {t.name} · #{t.templateId} · own {t.count}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {nftTemplateId !== null && (
                  <p className="text-xs text-cheese">
                    {nftLoading === 'assets'
                      ? 'Loading your NFTs…'
                      : `${nftPool.length.toLocaleString()} NFT${nftPool.length === 1 ? '' : 's'} available to drop`}
                  </p>
                )}
                {nftError && <p className="text-xs text-destructive">{nftError}</p>}
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Contract</Label>
                <Input
                  value={sendContract}
                  onChange={(e) => setSendContract(e.target.value.trim().toLowerCase())}
                  placeholder="eosio.token"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Symbol</Label>
                <Input
                  value={sendSymbol}
                  onChange={(e) => setSendSymbol(e.target.value.trim().toUpperCase())}
                  placeholder="WAX"
                  className="font-mono"
                />
              </div>
            </div>

            {tokenStat ? (
              <p className="text-xs text-cheese">
                {sendSymbol.toUpperCase()} · precision {tokenStat.precision} · supply{' '}
                {tokenStat.supply}
              </p>
            ) : (
              sendContract &&
              sendSymbol && (
                <p className="text-xs text-destructive">Token not found on {sendContract}.</p>
              )
            )}

            {walletTokens.length > 0 && (
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Your tokens</span>
                <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                  {walletTokens.slice(0, 40).map((t) => (
                    <button
                      key={`${t.contract}:${t.symbol}`}
                      type="button"
                      title={t.contract}
                      onClick={() => {
                        setSendContract(t.contract);
                        setSendSymbol(t.symbol);
                      }}
                      className={cn(
                        'rounded border px-2 py-0.5 font-mono text-xs transition-colors',
                        t.contract === sendContract && t.symbol === sendSymbol.toUpperCase()
                          ? 'border-cheese bg-cheese/10 text-cheese'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t.symbol} {t.amount.toFixed(Math.min(t.precision, 4))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
