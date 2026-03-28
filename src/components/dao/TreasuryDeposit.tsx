import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWax } from "@/context/WaxContext";
import {
  buildDepositToTreasuryAction, buildTokenDepositAction,
  buildAnnounceDepoAction, fetchUserTokenBalance,
} from "@/lib/dao";
import { TokenLogo } from "@/components/TokenLogo";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { Loader2, ArrowDownToLine, Wallet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/shared/TermsDialog";

interface TreasuryDepositProps {
  daoName: string;
  onDeposited: () => void;
}

interface TokenInfo {
  symbol: string;
  contract: string;
  precision: number;
}

const COMMON_TOKENS: TokenInfo[] = [
  { symbol: "WAX", contract: "eosio.token", precision: 8 },
  { symbol: "CHEESE", contract: "cheese4token", precision: 4 },
  { symbol: "WAXDAO", contract: "token.waxdao", precision: 8 },
  { symbol: "TLM", contract: "alien.worlds", precision: 4 },
  { symbol: "NEFTY", contract: "token.nefty", precision: 8 },
];

const CUSTOM_TOKEN_VALUE = "__custom__";

export function TreasuryDeposit({ daoName, onDeposited }: TreasuryDepositProps) {
  const { accountName, session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedTokenValue, setSelectedTokenValue] = useState(COMMON_TOKENS[0].symbol);
  const [userBalance, setUserBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Custom token fields
  const [customContract, setCustomContract] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [detectedPrecision, setDetectedPrecision] = useState<number>(8);

  const isCustomToken = selectedTokenValue === CUSTOM_TOKEN_VALUE;

  const getActiveToken = (): TokenInfo | null => {
    if (isCustomToken) {
      if (!customContract || !customSymbol) return null;
      return {
        symbol: customSymbol.toUpperCase(),
        contract: customContract.toLowerCase(),
        precision: detectedPrecision,
      };
    }
    return COMMON_TOKENS.find(t => t.symbol === selectedTokenValue) || null;
  };

  const activeToken = getActiveToken();

  useEffect(() => {
    if (accountName && activeToken) {
      loadUserBalance();
    } else if (!activeToken) {
      setUserBalance("0");
    }
  }, [accountName, selectedTokenValue, customContract, customSymbol]);

  async function loadUserBalance() {
    if (!accountName || !activeToken) return;
    setLoadingBalance(true);
    try {
      const balance = await fetchUserTokenBalance(
        activeToken.contract,
        activeToken.symbol,
        accountName
      );
      setUserBalance(balance);

      // Auto-detect precision from balance string
      if (isCustomToken && balance && balance !== "0") {
        const parts = balance.split(" ")[0].split(".");
        if (parts.length === 2) {
          setDetectedPrecision(parts[1].length);
        }
      }
    } catch (error) {
      console.error("Failed to load balance:", error);
      setUserBalance("0");
    } finally {
      setLoadingBalance(false);
    }
  }

  async function handleDeposit() {
    if (!session || !accountName || !activeToken || !amount || parseFloat(amount) <= 0) return;

    setLoading(true);

    const formattedAmount = `${parseFloat(amount).toFixed(activeToken.precision)} ${activeToken.symbol}`;

    const actions: any[] = [
      buildAnnounceDepoAction(accountName),
    ];

    // For non-WAX tokens, need tokendeposit action first
    if (activeToken.contract !== "eosio.token") {
      actions.push(buildTokenDepositAction(
        accountName,
        daoName,
        activeToken.symbol,
        activeToken.precision,
        activeToken.contract
      ));
    }

    actions.push(buildDepositToTreasuryAction(
      accountName,
      daoName,
      formattedAmount,
      activeToken.contract
    ));

    const result = await executeTransaction(actions, {
      successTitle: "Treasury Deposit! 🧀🏦",
      successDescription: `Deposited ${formattedAmount} to ${daoName} treasury`,
    });

    if (result.success) {
      setAmount("");
      await loadUserBalance();
      onDeposited();
    }
    setLoading(false);
  }

  if (!isConnected) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg text-center">
        <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connect your wallet to deposit tokens</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="h-5 w-5 text-primary" />
        <h4 className="font-medium">Deposit to Treasury</h4>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Token</Label>
          <Select
            value={selectedTokenValue}
            onValueChange={(value) => {
              setSelectedTokenValue(value);
              if (value !== CUSTOM_TOKEN_VALUE) {
                setCustomContract("");
                setCustomSymbol("");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TOKENS.map((token) => (
                <SelectItem key={token.symbol} value={token.symbol}>
                  <div className="flex items-center gap-2">
                    <TokenLogo contract={token.contract} symbol={token.symbol} size="sm" />
                    {token.symbol}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_TOKEN_VALUE}>
                Custom Token...
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isCustomToken && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-background/50 rounded-md border border-border/30">
            <div className="space-y-2">
              <Label className="text-xs">Contract</Label>
              <Input
                placeholder="e.g. eosio.token"
                value={customContract}
                onChange={(e) => setCustomContract(e.target.value.trim())}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Symbol</Label>
              <Input
                placeholder="e.g. WAX"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value.toUpperCase().trim())}
                className="h-9"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.00000001"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Your Balance:</span>
        <span className="font-medium">
          {loadingBalance ? (
            <Loader2 className="h-3 w-3 animate-spin inline" />
          ) : (
            userBalance
          )}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox id="terms-treasury" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(v === true)} className="mt-0.5" />
        <label htmlFor="terms-treasury" className="text-sm cursor-pointer leading-relaxed text-muted-foreground">
           I have read the{" "}
            <TermsDialog />
        </label>
      </div>

      <Button
        onClick={handleDeposit}
        disabled={loading || !amount || parseFloat(amount) <= 0 || !activeToken || !termsAgreed}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Depositing...
          </>
        ) : (
          <>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit {amount && activeToken ? `${amount} ${activeToken.symbol}` : ""}
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Anyone can deposit tokens. To withdraw, create a Token Transfer proposal.
      </p>
    </div>
  );
}
