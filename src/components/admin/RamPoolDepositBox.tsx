import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { sponsorDepositQuantity } from '@/components/admin/CryptSponsorDepositBox';

/** ram.chz treats a CHEESE transfer with this exact memo as a payout-pool top-up (empty memo buys RAM). */
export const RAM_POOL_MEMO = 'deposit';
const RAM_ACCOUNT = 'ram.chz';

export function RamPoolDepositBox() {
  const { session, accountName } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const quantity = sponsorDepositQuantity(amount);

  const deposit = async () => {
    if (!quantity || !accountName) return;
    setBusy(true);
    try {
      const res = await executeTransaction([{
        account: 'cheeseburger', name: 'transfer',
        authorization: [{ actor: accountName, permission: 'active' }],
        data: { from: accountName, to: RAM_ACCOUNT, quantity, memo: RAM_POOL_MEMO },
      }], { successTitle: 'RAM Pool Deposit Sent', successDescription: `${quantity} added to the RAM sell payout pool` });
      if (res.success) setAmount('');
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <Label className="text-xs text-muted-foreground">Fund CHEESE pool</Label>
      <div className="flex gap-2">
        <Input inputMode="decimal" placeholder="Amount of CHEESE" value={amount} onChange={e => setAmount(e.target.value)} disabled={busy} />
        <Button onClick={deposit} disabled={!quantity || !accountName || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sends to <span className="text-foreground">{RAM_ACCOUNT}</span> with memo <span className="text-foreground">"{RAM_POOL_MEMO}"</span>. This is a one-way top-up of the RAM sell payout pool.
        {!accountName ? ' Connect a wallet to deposit.' : ''}
      </p>
    </div>
  );
}
