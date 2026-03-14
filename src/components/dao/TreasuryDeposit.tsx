import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Coins } from "lucide-react";
import {
  buildTokenDepositAction, buildDepositToTreasuryAction,
  buildAnnounceDepoAction,
} from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";

const WAX_TOKENS = [
  { symbol: "WAX", contract: "eosio.token", precision: 8 },
  { symbol: "CHEESE", contract: "cheese4token", precision: 4 },
  { symbol: "WAXDAO", contract: "token.waxdao", precision: 8 },
  { symbol: "TLM", contract: "alien.worlds", precision: 4 },
  { symbol: "NEFTY", contract: "token.nefty", precision: 8 },
];

interface TreasuryDepositProps {
  daoName: string;
  onDeposited: () => void;
}

export function TreasuryDeposit({ daoName, onDeposited }: TreasuryDepositProps) {
  const { accountName, session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();

  const [selectedToken, setSelectedToken] = useState("WAX");
  const [amount, setAmount] = useState("");
  const [customContract, setCustomContract] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customPrecision, setCustomPrecision] = useState(8);
  const [loading, setLoading] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  const handleDeposit = async () => {
    if (!session || !accountName || !amount) return;
    setLoading(true);

    let tokenContract: string, tokenSymbol: string, tokenPrecision: number;

    if (useCustom) {
      tokenContract = customContract;
      tokenSymbol = customSymbol;
      tokenPrecision = customPrecision;
    } else {
      const token = WAX_TOKENS.find(t => t.symbol === selectedToken)!;
      tokenContract = token.contract;
      tokenSymbol = token.symbol;
      tokenPrecision = token.precision;
    }

    const formatted = `${parseFloat(amount).toFixed(tokenPrecision)} ${tokenSymbol}`;

    const actions = [
      buildAnnounceDepoAction(accountName),
      buildTokenDepositAction(accountName, daoName, tokenSymbol, tokenPrecision, tokenContract),
      buildDepositToTreasuryAction(accountName, daoName, formatted, tokenContract),
    ];

    const result = await executeTransaction(actions, {
      successTitle: "Treasury Deposit! 🧀🏦",
      successDescription: `Deposited ${formatted} to ${daoName} treasury`,
    });

    if (result.success) {
      setAmount("");
      onDeposited();
    }
    setLoading(false);
  };

  if (!isConnected) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Connect wallet to deposit to treasury
      </div>
    );
  }

  return (
    <Card className="bg-card/60 border-border/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Deposit Tokens to Treasury</Label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={useCustom ? "outline" : "default"}
            size="sm"
            onClick={() => setUseCustom(false)}
            className="text-xs"
          >
            Common Tokens
          </Button>
          <Button
            variant={useCustom ? "default" : "outline"}
            size="sm"
            onClick={() => setUseCustom(true)}
            className="text-xs"
          >
            Custom Token
          </Button>
        </div>

        {!useCustom ? (
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WAX_TOKENS.map(t => (
                <SelectItem key={t.symbol} value={t.symbol}>{t.symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Contract" value={customContract} onChange={e => setCustomContract(e.target.value)} />
            <Input placeholder="SYMBOL" value={customSymbol} onChange={e => setCustomSymbol(e.target.value.toUpperCase())} />
            <Input type="number" placeholder="Precision" value={customPrecision} onChange={e => setCustomPrecision(parseInt(e.target.value) || 8)} />
          </div>
        )}

        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <Button onClick={handleDeposit} disabled={loading || !amount} className="w-full" size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Deposit to Treasury
        </Button>
      </CardContent>
    </Card>
  );
}
