// CHEESEAir — step 1: choose the token, NFT template or RAM being airdropped.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { cn } from '@/lib/utils';
import { formatCheese } from '@/lib/airdropResources';
import { CHEESE_RAM_CONTRACT, CHEESE_SYMBOL } from '@/lib/airdropCheese';
import type { InventoryTemplate } from '@/lib/airdropChain';
import { useAirdrop } from './AirdropContext';

export function AirSendCard() {
  const {
    assetKind,
    setAssetKind,
    isNft,
    isRam,
    ramLimits,
    cheesePerRamKb,
    cheeseBalance,
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

        <Tabs value={assetKind} onValueChange={(v) => setAssetKind(v as 'token' | 'nft' | 'ram')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="token">Token</TabsTrigger>
            <TabsTrigger value="nft">NFTs</TabsTrigger>
            <TabsTrigger value="ram">RAM</TabsTrigger>
          </TabsList>
        </Tabs>

        {isRam ? (
          <div className="mt-3 space-y-3">
            <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
              Your {CHEESE_SYMBOL} buys RAM through <span className="text-cheese">{CHEESE_RAM_CONTRACT}</span>{' '}
              and the RAM is delivered straight into each recipient&apos;s own account. You pay no RAM
              rows yourself, and each recipient receives one purchase.
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">RAM price</dt>
                <dd className="font-mono text-foreground">
                  {cheesePerRamKb !== null
                    ? `${formatCheese(cheesePerRamKb)} ${CHEESE_SYMBOL} / KB`
                    : actor
                      ? 'unavailable'
                      : 'connect wallet'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Your {CHEESE_SYMBOL} balance</dt>
                <dd className="font-mono text-cheese">
                  {cheeseBalance !== null ? formatCheese(cheeseBalance) : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Per-recipient limits</dt>
                <dd className="font-mono text-foreground">
                  {ramLimits
                    ? `${formatCheese(ramLimits.minCheese)} – ${formatCheese(ramLimits.maxCheese)} ${CHEESE_SYMBOL}`
                    : 'unavailable'}
                </dd>
              </div>
            </dl>
          </div>
        ) : isNft ? (
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
                  <TemplatePicker
                    templates={nftTemplates}
                    templateId={nftTemplateId}
                    loading={nftLoading === 'templates'}
                    onSelect={setNftTemplateId}
                  />
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

interface TemplatePickerProps {
  templates: InventoryTemplate[];
  templateId: number | null;
  loading: boolean;
  onSelect: (id: number | null) => void;
}

function TemplatePicker({ templates, templateId, loading, onSelect }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = templates.find((t) => t.templateId === templateId) ?? null;

  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">
        Template to airdrop (1 NFT per recipient)
        {loading && ' · loading…'}
      </Label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-2 py-2 text-left font-mono text-sm text-foreground"
      >
        {selected ? (
          <>
            <IpfsImage
              src={selected.image}
              alt={selected.name}
              className="h-8 w-8 shrink-0 rounded border border-border object-cover"
            />
            <span className="min-w-0 flex-1 truncate">
              {selected.name} <span className="text-muted-foreground">· #{selected.templateId} · own {selected.count}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">Select a template…</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-background">
          {templates.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No templates found.</p>
          )}
          {templates.map((t) => (
            <button
              key={t.templateId}
              type="button"
              onClick={() => {
                onSelect(t.templateId);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-xs transition-colors',
                t.templateId === templateId
                  ? 'bg-cheese/10 text-cheese'
                  : 'text-foreground hover:bg-muted/50',
              )}
            >
              <IpfsImage
                src={t.image}
                alt={t.name}
                className="h-8 w-8 shrink-0 rounded border border-border object-cover"
              />
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className="shrink-0 text-muted-foreground">#{t.templateId} · own {t.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
