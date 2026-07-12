import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ExternalLink, Package, RefreshCw } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { useWojakPacks, useInvalidateWojakPacks, WojakPack } from '@/hooks/useWojakPacks';
import { buildUnboxAction, WAXDAO_UNBOX_CONTRACT, WOJAK_UNBOX_POOL_ID, WOJAK_PACK_COLLECTION } from '@/lib/wojakUnbox';
import { getImageUrl } from '@/services/atomicApi';
import { TermsDialog } from '@/components/shared/TermsDialog';
import { toast } from 'sonner';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';


interface WojakUnboxManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

export function WojakUnboxManager({ onTransactionComplete, onTransactionSuccess }: WojakUnboxManagerProps) {
  const { session, accountName } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { data: packs = [], isLoading, refetch, isFetching } = useWojakPacks(accountName);
  const invalidatePacks = useInvalidateWojakPacks();

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);

  const handleOpen = async (pack: WojakPack) => {
    if (!session || !accountName) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!termsAgreed) {
      toast.error('Please agree to the Terms of Use first');
      return;
    }
    setOpeningAssetId(pack.assetId);
    try {
      const action = buildUnboxAction(accountName, pack.assetId, session.permissionLevel);
      const result = await executeTransaction([action], {
        showSuccessToast: false,
        showErrorToast: true,
        errorTitle: 'Pack Open Failed',
      });
      if (result.success) {
        onTransactionSuccess?.(
          'Pack Opened! 📦🧀',
          `Your Waxy Wojak should arrive shortly from ${WAXDAO_UNBOX_CONTRACT}.`,
          result.txId,
        );
        // Give the indexer a few seconds to reflect the burn + new mint.
        setTimeout(() => {
          invalidatePacks(accountName);
          refetch();
        }, 6000);
        onTransactionComplete?.();
      }
    } finally {
      setOpeningAssetId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/20">
        <div className="shrink-0 h-16 w-16 rounded-md overflow-hidden bg-muted/50 flex items-center justify-center">
          <img
            src={getImageUrl('QmcMHEk3SLzQEoYDykiCy1bJ6DuYy7fwQWsByVhfQuY7pL')}
            alt="Waxy Wojak Pack"
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-cheese" />
            <OpenMojiIcon emoji="📦" size={18} /> Open Wojak Pack
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Open Waxy Wojak Packs through WaxDAO unbox pool #{WOJAK_UNBOX_POOL_ID}.
            Each pack burns and mints a random Wojak NFT back to your wallet.
          </p>
          <a
            href={`https://waxblock.io/account/${WAXDAO_UNBOX_CONTRACT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cheese hover:underline inline-flex items-center gap-1 mt-1"
          >
            View unbox contract <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Header row: count + refresh */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Your Packs{' '}
          <span className="text-cheese">({packs.length})</span>
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Grid */}
      {!accountName ? (
        <p className="text-sm text-muted-foreground">Connect your wallet to see your packs.</p>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading packs…
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-lg">
          <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No Waxy Wojak Packs in this wallet.
          </p>
          <a
            href={`https://wax.atomichub.io/market?collection_name=${WOJAK_PACK_COLLECTION}&schema_name=wojakpacks&order=asc&sort=price`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cheese hover:underline inline-flex items-center gap-1 mt-2"
          >
            Grab one on AtomicHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {packs.map((pack) => {
            const isOpening = openingAssetId === pack.assetId;
            const disabled = !termsAgreed || isOpening || openingAssetId !== null;
            return (
              <div
                key={pack.assetId}
                className="rounded-lg border border-border bg-muted/20 overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-muted/40 relative">
                  <img
                    src={getImageUrl(pack.image)}
                    alt={pack.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  {pack.mintNumber !== null && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-cheese text-primary-foreground text-[10px] font-bold font-mono shadow-md leading-none">
                      #{pack.mintNumber}
                    </span>
                  )}
                </div>
                <div className="p-2 flex-1 flex flex-col gap-1.5">
                  <p className="text-xs font-medium truncate">{pack.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {pack.assetId}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => handleOpen(pack)}
                    disabled={disabled}
                    className="w-full mt-1 bg-cheese hover:bg-cheese-dark text-primary-foreground"
                  >
                    {isOpening ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Opening…
                      </>
                    ) : (
                      <>
                        <Package className="h-3.5 w-3.5 mr-1" /> Open Pack
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Terms gate */}
      <div className="flex items-start gap-3 pt-2 border-t border-border">
        <Checkbox
          id="terms-wojak-unbox"
          checked={termsAgreed}
          onCheckedChange={(v) => setTermsAgreed(v === true)}
          className="mt-0.5"
        />
        <label htmlFor="terms-wojak-unbox" className="text-sm cursor-pointer leading-relaxed text-muted-foreground">
          I understand opening a pack permanently destroys it on-chain and I have read the{' '}
          <TermsDialog />
        </label>
      </div>
    </div>
  );
}