import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';
import type { TokenWithBalance } from '@/hooks/useAllTokenBalances';

interface SendTokensFormProps {
  balances: TokenWithBalance[];
  recipient: string;
  setRecipient: (value: string) => void;
  selectedToken: TokenWithBalance | null;
  setSelectedToken: (token: TokenWithBalance) => void;
  amount: string;
  setAmount: (value: string) => void;
  memo: string;
  setMemo: (value: string) => void;
  canSend: boolean;
  isSending: boolean;
  handleSend: () => void;
}

/**
 * Send Tokens tab. The parent owns the form state so entries survive switching
 * wallet sections, exactly as before the split.
 */
export const SendTokensForm = memo(function SendTokensForm({
  balances,
  recipient,
  setRecipient,
  selectedToken,
  setSelectedToken,
  amount,
  setAmount,
  memo,
  setMemo,
  canSend,
  isSending,
  handleSend,
}: SendTokensFormProps) {
  return (
    <div className="space-y-5">
      {/* Recipient */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Recipient</Label>
        <Input
          placeholder="Enter WAX account"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.toLowerCase())}
        />
      </div>

      {/* Token Select */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Token</Label>
        <Select
          value={selectedToken ? `${selectedToken.contract}:${selectedToken.symbol}` : ""}
          onValueChange={(val) => {
            const token = balances.find(b => `${b.contract}:${b.symbol}` === val);
            if (token) setSelectedToken(token);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a token">
              {selectedToken && (
                <span className="flex items-center gap-2">
                  <TokenLogo contract={selectedToken.contract} symbol={selectedToken.symbol} size="sm" />
                  <span className="font-medium">{selectedToken.symbol}</span>
                  <span className="text-muted-foreground">({selectedToken.balance.toLocaleString(undefined, { minimumFractionDigits: Math.min(2, Math.min(20, Math.max(0, selectedToken.precision || 0))), maximumFractionDigits: Math.min(20, Math.max(0, selectedToken.precision || 0)) })})</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {balances.map((b) => (
              <SelectItem key={`${b.contract}:${b.symbol}`} value={`${b.contract}:${b.symbol}`}>
                <span className="flex items-center gap-2">
                  <TokenLogo contract={b.contract} symbol={b.symbol} size="sm" />
                  <span className="font-medium">{b.symbol}</span>
                  <span className="text-muted-foreground ml-1">({b.balance.toLocaleString(undefined, { minimumFractionDigits: Math.min(2, Math.min(20, Math.max(0, b.precision || 0))), maximumFractionDigits: Math.min(20, Math.max(0, b.precision || 0)) })})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Amount</Label>
          {selectedToken && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              Balance: <TokenLogo contract={selectedToken.contract} symbol={selectedToken.symbol} size="sm" />
              <span>{selectedToken.balance.toLocaleString(undefined, { minimumFractionDigits: Math.min(2, Math.min(20, Math.max(0, selectedToken.precision || 0))), maximumFractionDigits: Math.min(20, Math.max(0, selectedToken.precision || 0)) })} {selectedToken.symbol}</span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (selectedToken) {
                setAmount(selectedToken.balance.toFixed(selectedToken.precision));
              }
            }}
            disabled={!selectedToken}
            className="shrink-0 font-semibold"
          >
            Max
          </Button>
        </div>
      </div>

      {/* Memo */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Memo (optional)</Label>
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
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send {selectedToken?.symbol || "Tokens"}
          </>
        )}
      </Button>
    </div>
  );
});
