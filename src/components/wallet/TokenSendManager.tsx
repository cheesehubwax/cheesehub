import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWax } from '@/context/WaxContext';
import { useAllTokenBalances, TokenWithBalance } from '@/hooks/useAllTokenBalances';
import { TokenLogo } from '@/components/TokenLogo';
import { Loader2, Send, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface TokenSendManagerProps {
  onTransactionSuccess: (title: string, description: string, txId: string | null) => void;
}

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

export function TokenSendManager({ onTransactionSuccess }: TokenSendManagerProps) {
  const { accountName, transferToken } = useWax();
  const { tokens: balances, isLoading: balancesLoading } = useAllTokenBalances(accountName || undefined);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedTokenKey, setSelectedTokenKey] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const selectedBalance = balances.find(b => `${b.contract}:${b.symbol}` === selectedTokenKey);
  const isValidRecipient = recipient.length > 0 && isValidWaxAccount(recipient);
  const canSend = isValidRecipient && parseFloat(amount) > 0 && selectedBalance && !isSending;

  const handleSend = async () => {
    if (!canSend || !selectedBalance) return;
    setIsSending(true);
    try {
      const txId = await transferToken(
        selectedBalance.contract,
        selectedBalance.symbol,
        selectedBalance.precision,
        recipient,
        parseFloat(amount),
        memo
      );
      if (txId) {
        onTransactionSuccess(
          'Transfer Successful! 🧀',
          `Sent ${amount} ${selectedBalance.symbol} to ${recipient}`,
          txId
        );
        setAmount('');
        setRecipient('');
        setMemo('');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Transfer failed');
    } finally {
      setIsSending(false);
    }
  };

  const setPercentage = (percent: number) => {
    if (!selectedBalance) return;
    setAmount((selectedBalance.balance * percent / 100).toFixed(selectedBalance.precision));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Send className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Send Tokens</h3>
      </div>

      <div className="space-y-2">
        <Label>Token</Label>
        <Select value={selectedTokenKey} onValueChange={setSelectedTokenKey}>
          <SelectTrigger>
            <SelectValue placeholder={balancesLoading ? 'Loading...' : 'Select token'} />
          </SelectTrigger>
          <SelectContent>
            {balances.map(b => (
              <SelectItem key={`${b.contract}:${b.symbol}`} value={`${b.contract}:${b.symbol}`}>
                <span className="flex items-center gap-2">
                  <TokenLogo contract={b.contract} symbol={b.symbol} size="sm" />
                  {b.symbol} — {b.balance.toLocaleString()}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Recipient</Label>
        <div className="relative">
          <Input
            placeholder="Enter WAX account"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.toLowerCase())}
            className="pr-10"
          />
          {recipient.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValidRecipient ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Amount</Label>
        <Input
          type="number"
          placeholder="0.0000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={0}
        />
        <div className="flex gap-2">
          {[25, 50, 75, 100].map(p => (
            <Button
              key={p}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage(p)}
              className="flex-1 text-xs border-primary/30 hover:bg-primary/10 text-primary"
            >
              {p}%
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Memo (optional)</Label>
        <Input
          placeholder="Enter memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      <Button
        onClick={handleSend}
        disabled={!canSend}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {isSending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
        ) : (
          <><Send className="mr-2 h-4 w-4" />Send {selectedBalance?.symbol || 'Tokens'}</>
        )}
      </Button>
    </div>
  );
}
