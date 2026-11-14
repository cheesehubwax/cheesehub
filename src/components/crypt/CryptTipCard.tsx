import { explorerTx } from '@/lib/explorer';
import { useQuery } from '@tanstack/react-query';
import { fetchTipVerified, type Tip } from '@/lib/cryptTips';

/** Tip card: verified only when the same transaction carries the matching wallet-to-wallet transfer. */
export function CryptTipCard({ tip, sender, txId, nameFor }: { tip: Tip; sender: string; txId: string; nameFor: (id: string) => string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['crypt-tip', txId, sender, tip.recipient, tip.amount],
    queryFn: async () => { const v = await fetchTipVerified(txId, sender, tip); if (v === null) throw new Error('not indexed'); return v; },
    enabled: !!txId, staleTime: Infinity, retry: 4, retryDelay: n => 3000 * (n + 1),
  });
  const amount = tip.amount.replace(/\.?0+$/, '');
  return (
    <span className="block rounded-md border border-primary/40 bg-primary/10 px-3 py-2">
      <span className="block font-semibold text-primary">🧀 Tipped {amount} CHEESE to @{nameFor(tip.recipient)}</span>
      {tip.note && <span className="block mt-0.5">{tip.note}</span>}
      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {isLoading ? 'Checking transfer…' : data === true ? '✅ Verified on chain' : data === false ? '⚠️ Unverified tip — no matching transfer' : '⏳ Transfer not confirmed yet'}
        {txId && <a href={explorerTx(txId)} target="_blank" rel="noopener noreferrer" className="underline">transaction</a>}
      </span>
    </span>
  );
}
