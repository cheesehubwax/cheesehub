import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';

/** Must match SPONSOR_MEMO in contracts/cheesecrypt/include/cheesecrypt.hpp exactly. */
export const CRYPT_SPONSOR_MEMO = 'CHEESECrypt sponsor deposit';
const CRYPT_ACCOUNT = 'crypt.cheese';

/** Normalises a typed CHEESE amount to a 4-decimal asset string, or null when invalid. */
export function sponsorDepositQuantity(input: string): string | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  const units = BigInt(w) * 10000n + BigInt((f + '0000').slice(0, 4));
  if (units <= 0n) return null;
  return `${units / 10000n}.${String(units % 10000n).padStart(4, '0')} CHEESE`;
}

export function CryptSponsorDepositBox({ funder }: { funder: string | null }) {
  const { session, accountName } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const quantity = sponsorDepositQuantity(amount);
  const isFunder = !!funder && accountName === funder;

  const deposit = async () => {
    if (!quantity || !isFunder || !accountName) return;
    setBusy(true);
    try {
      const res = await executeTransaction([{
        account: 'cheeseburger', name: 'transfer',
        authorization: [{ actor: accountName, permission: 'active' }],
        data: { from: accountName, to: CRYPT_ACCOUNT, quantity, memo: CRYPT_SPONSOR_MEMO },
      }], { successTitle: 'Sponsor Deposit Sent', successDescription: `${quantity} added to free messaging` });
      if (res) setAmount('');
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <Label className="text-xs text-muted-foreground">Fund free messages</Label>
      <div className="flex gap-2">
        <Input inputMode="decimal" placeholder="Amount of CHEESE" value={amount} onChange={e => setAmount(e.target.value)} disabled={busy} />
        <Button onClick={deposit} disabled={!quantity || !isFunder || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sends to <span className="text-foreground">{CRYPT_ACCOUNT}</span> with memo <span className="text-foreground">"{CRYPT_SPONSOR_MEMO}"</span>.
        {!funder ? ' Run setbudget first.' : !isFunder ? ` Only ${funder} can deposit — connect that account.` : ''}
      </p>
    </div>
  );
}
