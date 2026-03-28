import { useState, useEffect } from "react";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { useWax } from "@/context/WaxContext";
import {
  fetchAllLPTokens,
  LPTokenBalance,
  DEX,
  DexType,
  LIQLOCKER_CONTRACT,
  getDexDisplayName
} from "@/lib/liqlocker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Calendar, AlertCircle, Droplets } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/shared/TermsDialog";

export function CreateLiquidityLock() {
  const waxContext = useWax();
  const { toast } = useToast();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [lpTokens, setLpTokens] = useState<LPTokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const session = waxContext?.session ?? null;
  const accountName = waxContext?.accountName ?? null;
  const isConnected = waxContext?.isConnected ?? false;

  const [selectedDex, setSelectedDex] = useState<DexType>(DEX.DEFIBOX);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [unlockTime, setUnlockTime] = useState("00:00");

  useEffect(() => {
    if (accountName) {
      loadLPTokens();
    }
  }, [accountName]);

  const loadLPTokens = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const tokens = await fetchAllLPTokens(accountName);
      setLpTokens(tokens);
    } catch (error) {
      console.error("Failed to load LP tokens:", error);
    }
    setLoading(false);
  };

  const filteredTokens = lpTokens.filter((t) => t.dex === selectedDex);

  const getSelectedTokenInfo = () => {
    return filteredTokens.find((t) => `${t.contract}:${t.symbol}` === selectedToken);
  };

  const handleDexChange = (dex: string) => {
    setSelectedDex(dex as DexType);
    setSelectedToken("");
  };

  const handleCreate = async () => {
    if (!session || !accountName) return;

    const tokenInfo = getSelectedTokenInfo();
    if (!tokenInfo) {
      toast({ title: "Error", description: "Please select an LP token", variant: "destructive" });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    if (!unlockDate) {
      toast({ title: "Error", description: "Please select an unlock date", variant: "destructive" });
      return;
    }

    const unlockDateTime = new Date(`${unlockDate}T${unlockTime}:00Z`);
    if (unlockDateTime <= new Date()) {
      toast({ title: "Error", description: "Unlock time must be in the future", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const decimalPart = tokenInfo.amount.split(".")[1];
      const precision = decimalPart ? decimalPart.length : 0;
      const formattedAmount = `${parseFloat(amount).toFixed(precision)} ${tokenInfo.symbol}`;
      const unlockTimestamp = Math.floor(unlockDateTime.getTime() / 1000);

      await session.transact({
        actions: [
          {
            account: LIQLOCKER_CONTRACT,
            name: "createlock",
            authorization: [session.permissionLevel],
            data: {
              amount: formattedAmount,
              creator: accountName,
              receiver: accountName,
              token_contract: tokenInfo.contract,
              unlock_time: unlockTimestamp,
            },
          },
          {
            account: tokenInfo.contract,
            name: "transfer",
            authorization: [session.permissionLevel],
            data: {
              from: accountName,
              to: LIQLOCKER_CONTRACT,
              quantity: formattedAmount,
              memo: "deposit_v2",
            },
          },
        ],
      });

      toast({ title: "Liquidity Lock Created!", description: `Successfully locked ${formattedAmount}` });
      setAmount("");
      setUnlockDate("");
      setUnlockTime("00:00");
      setSelectedToken("");
    } catch (error: any) {
      closeWharfkitModals();
      toast({ title: "Lock Failed", description: error.message || "Failed to create liquidity lock", variant: "destructive" });
    } finally {
      setCreating(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  if (!isConnected) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Connect your wallet to create a liquidity lock
          </p>
        </CardContent>
      </Card>
    );
  }

  const tokenInfo = getSelectedTokenInfo();
  const minDate = new Date().toISOString().split("T")[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-cheese" />
          Create Liquidity Lock
        </CardTitle>
        <CardDescription>
          Lock your LP tokens from Defibox or TacoSwap until a specified date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Select DEX</Label>
          <Tabs value={selectedDex} onValueChange={handleDexChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={DEX.DEFIBOX} className="gap-2">
                <span className="text-lg">📦</span>
                Defibox
              </TabsTrigger>
              <TabsTrigger value={DEX.TACO} className="gap-2">
                <span className="text-lg">🌮</span>
                TacoSwap
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lp-token">Select LP Token</Label>
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger id="lp-token">
              <SelectValue placeholder={loading ? "Loading LP tokens..." : "Choose an LP token"} />
            </SelectTrigger>
            <SelectContent>
              {filteredTokens.length === 0 ? (
                <SelectItem value="none" disabled>
                  No LP tokens found on {getDexDisplayName(selectedDex)}
                </SelectItem>
              ) : (
                [...filteredTokens]
                  .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
                  .map((token) => (
                    <SelectItem
                      key={`${token.contract}:${token.symbol}`}
                      value={`${token.contract}:${token.symbol}`}
                    >
                      <span className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-cheese" />
                        {token.symbol} - {token.amount}
                      </span>
                    </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
          {tokenInfo && (
            <p className="text-xs text-muted-foreground">
              Available: {tokenInfo.amount} {tokenInfo.symbol}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lp-amount">Amount to Lock</Label>
          <div className="relative">
            <Input
              id="lp-amount"
              type="number"
              placeholder="0.00000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-20"
            />
            {tokenInfo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-cheese hover:text-cheese-dark"
                onClick={() => setAmount(tokenInfo.amount)}
              >
                MAX
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lp-unlock-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Unlock Date
            </Label>
            <Input
              id="lp-unlock-date"
              type="date"
              min={minDate}
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-unlock-time">Unlock Time (UTC)</Label>
            <Input
              id="lp-unlock-time"
              type="time"
              value={unlockTime}
              onChange={(e) => setUnlockTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
          <AlertCircle className="h-5 w-5 text-cheese shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Important</p>
            <p>
              Locked LP tokens cannot be retrieved until the unlock date. Liquidity will remain in the pool earning fees while locked.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox id="terms-liqlock" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(v === true)} className="mt-0.5" />
          <label htmlFor="terms-liqlock" className="text-sm cursor-pointer leading-relaxed text-muted-foreground">
           I have read the{" "}
            <TermsDialog />
          </label>
        </div>

        <Button
          onClick={handleCreate}
          disabled={creating || !selectedToken || !amount || !unlockDate || !termsAgreed}
          className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold"
          size="lg"
        >
          {creating ? (
            <>
              <Lock className="h-4 w-4 mr-2 animate-pulse" />
              Creating Lock...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Lock LP Tokens
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
