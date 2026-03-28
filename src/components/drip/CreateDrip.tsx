import { useState, useEffect } from "react";
import { useWax } from "@/context/WaxContext";
import { useAllTokenBalances } from "@/hooks/useAllTokenBalances";
import { ESCROW_CONTRACT, calculateTotalDeposit, parseAsset, fetchUserDrips } from "@/lib/drip";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTokenLogoUrl } from "@/lib/tokenLogos";
import { setDripName } from "@/lib/dripNames";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/shared/TermsDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TOKEN_LOGO_PLACEHOLDER = '/placeholder.svg';

const HOUR_PRESETS = [
  { label: "1h", value: 1 },
  { label: "6h", value: 6 },
  { label: "12h", value: 12 },
  { label: "24h", value: 24 },
  { label: "48h", value: 48 },
  { label: "1w", value: 168 },
];

export function CreateDrip() {
  const { session, accountName, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const { tokens: allTokens, isLoading: loading } = useAllTokenBalances(accountName || undefined);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Form state
  const [dripLabel, setDripLabel] = useState("");
  const [receiver, setReceiver] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenContract, setTokenContract] = useState("");
  const [tokenPrecision, setTokenPrecision] = useState("4");
  const [hoursBetween, setHoursBetween] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedToken, setSelectedToken] = useState<string>("");

  // When selecting from token dropdown, auto-fill fields
  useEffect(() => {
    if (selectedToken) {
      const [contract, symbol] = selectedToken.split(":");
      const token = allTokens.find(t => t.contract === contract && t.symbol === symbol);
      if (token) {
        setTokenName(token.symbol);
        setTokenContract(token.contract);
        setTokenPrecision(String(token.precision));
      }
    }
  }, [selectedToken, allTokens]);

  const precision = parseInt(tokenPrecision) || 4;
  const payoutNum = parseFloat(payoutAmount) || 0;
  const hoursNum = parseFloat(hoursBetween) || 0;
  const endDateObj = endDate ? new Date(endDate + "T23:59:59Z") : null;

  const summary = endDateObj && hoursNum > 0 && payoutNum > 0
    ? calculateTotalDeposit(payoutNum, hoursNum, endDateObj)
    : null;

  const missingFields = [
    !receiver && "Receiving Account",
    !payoutAmount && "Amount Per Payment",
    !tokenName && "Token Name",
    !tokenContract && "Token Contract",
    !hoursBetween && "Hours Between Payments",
    !endDate && "Drip Completion Date",
  ].filter(Boolean) as string[];

  const handleCreate = async () => {
    if (!session || !accountName) return;

    if (!receiver.trim()) {
      toast({ title: "Error", description: "Enter a receiving account", variant: "destructive" });
      return;
    }
    if (payoutNum <= 0) {
      toast({ title: "Error", description: "Enter a valid payout amount", variant: "destructive" });
      return;
    }
    if (!tokenName.trim() || !tokenContract.trim()) {
      toast({ title: "Error", description: "Enter token details", variant: "destructive" });
      return;
    }
    if (hoursNum <= 0) {
      toast({ title: "Error", description: "Enter hours between payments", variant: "destructive" });
      return;
    }
    if (!endDateObj || endDateObj <= new Date()) {
      toast({ title: "Error", description: "End date must be in the future", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const formattedPayout = `${payoutNum.toFixed(precision)} ${tokenName}`;
      const endTimestamp = Math.floor(endDateObj.getTime() / 1000);

      // Step 1: Create the drip
      const result = await executeTransaction(
        [{
          account: ESCROW_CONTRACT,
          name: "createdrip",
          authorization: [session.permissionLevel],
          data: {
            payer: accountName,
            receiver: receiver.trim().toLowerCase(),
            payout_amount: formattedPayout,
            token_contract: tokenContract.trim(),
            hours_between_payouts: Math.floor(hoursNum),
            end_time: endTimestamp,
          },
        }],
        {
          successTitle: "Drip Created!",
          successDescription: "Now deposit tokens to activate it.",
          errorTitle: "Create Failed",
        }
      );

      if (!result.success) {
        setCreating(false);
        return;
      }

      // Step 2: Find the newly created drip ID by querying the table
      setStep(2);
      toast({
        title: "Finding Drip ID...",
        description: "Querying the contract for your new drip.",
      });

      // Small delay to let the chain propagate
      await new Promise(r => setTimeout(r, 2000));

      const { paying } = await fetchUserDrips(accountName);
      const newDrip = paying
        .filter(d => d.receiver === receiver.trim().toLowerCase())
        .sort((a, b) => b.ID - a.ID)[0];

      if (!newDrip) {
        toast({
          title: "Drip Created",
          description: "Could not auto-detect drip ID. Please deposit manually from My Drips tab.",
          variant: "destructive",
        });
        setCreating(false);
        setStep(1);
        return;
      }

      // Step 3: Deposit tokens
      const totalAmount = summary ? summary.totalAmount : payoutNum;
      const formattedDeposit = `${totalAmount.toFixed(precision)} ${tokenName}`;

      const depositResult = await executeTransaction(
        [{
          account: tokenContract.trim(),
          name: "transfer",
          authorization: [session.permissionLevel],
          data: {
            from: accountName,
            to: ESCROW_CONTRACT,
            quantity: formattedDeposit,
            memo: `|drip_deposit|${newDrip.ID}|`,
          },
        }],
        {
          successTitle: "Drip Funded!",
          successDescription: `Deposited ${formattedDeposit} for drip #${newDrip.ID}`,
          errorTitle: "Deposit Failed",
        }
      );

      if (depositResult.success) {
        if (dripLabel.trim() && newDrip) {
          setDripName(accountName, newDrip.ID, dripLabel.trim());
        }
        setDripLabel("");
        setReceiver("");
        setPayoutAmount("");
        setTokenName("");
        setTokenContract("");
        setTokenPrecision("4");
        setHoursBetween("");
        setEndDate("");
        setSelectedToken("");
      }
    } catch (error) {
      console.error("Create drip failed:", error);
    } finally {
      setCreating(false);
      setStep(1);
    }
  };

  if (!isConnected) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Connect your wallet to create a slow drip escrow
          </p>
        </CardContent>
      </Card>
    );
  }

  const minDate = new Date().toISOString().split("T")[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-cheese" />
          Create Slow Drip
          <a href="https://www.youtube.com/watch?v=zZy6nE0Qmz8" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-cheese hover:text-cheese-dark underline underline-offset-2 ml-1">
            Watch me
          </a>
        </CardTitle>
        <CardDescription>
          Set up automated token payments that drip to a recipient over time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drip Name */}
        <div className="space-y-2">
          <Label htmlFor="dripLabel">Drip Name (optional)</Label>
          <Input
            id="dripLabel"
            placeholder="e.g. Mike's salary, Vesting Q2"
            value={dripLabel}
            onChange={e => setDripLabel(e.target.value)}
            maxLength={50}
          />
          <p className="text-xs text-muted-foreground">Stored locally for your reference only — not on-chain.</p>
        </div>

        {/* Receiving Account */}
        <div className="space-y-2">
          <Label htmlFor="receiver">Receiving Account</Label>
          <Input
            id="receiver"
            placeholder="e.g. mike.wam"
            value={receiver}
            onChange={e => setReceiver(e.target.value)}
          />
        </div>

        {/* Token Selection from Balances */}
        <div className="space-y-2">
          <Label>Select from Your Tokens (optional)</Label>
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading tokens..." : "Auto-fill from balances"} />
            </SelectTrigger>
            <SelectContent>
              {allTokens.map(token => (
                <SelectItem
                  key={`${token.contract}:${token.symbol}`}
                  value={`${token.contract}:${token.symbol}`}
                >
                  <span className="flex items-center gap-2">
                    <img
                      src={getTokenLogoUrl(token.contract, token.symbol)}
                      alt={token.symbol}
                      className="h-4 w-4 rounded-full"
                      onError={e => { e.currentTarget.src = TOKEN_LOGO_PLACEHOLDER; }}
                    />
                    {token.symbol} - {token.balance.toFixed(token.precision)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Token Details (manual or auto-filled) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tokenName">Token Name</Label>
            <Input
              id="tokenName"
              placeholder="e.g. WAX"
              value={tokenName}
              onChange={e => setTokenName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tokenContract">Token Contract</Label>
            <Input
              id="tokenContract"
              placeholder="e.g. eosio.token"
              value={tokenContract}
              onChange={e => setTokenContract(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tokenPrecision">Precision</Label>
            <Input
              id="tokenPrecision"
              type="number"
              min="0"
              max="16"
              value={tokenPrecision}
              onChange={e => setTokenPrecision(e.target.value)}
            />
          </div>
        </div>

        {/* Amount Per Payment */}
        <div className="space-y-2">
          <Label htmlFor="payoutAmount">Amount Per Payment</Label>
          <div className="relative">
            <Input
              id="payoutAmount"
              type="number"
              placeholder="0.0000"
              value={payoutAmount}
              onChange={e => setPayoutAmount(e.target.value)}
              className="pr-20"
            />
            {tokenName && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {tokenName}
              </span>
            )}
          </div>
        </div>

        {/* Hours Between Payments */}
        <div className="space-y-2">
          <Label htmlFor="hoursBetween">Hours Between Payments</Label>
          <Input
            id="hoursBetween"
            type="number"
            placeholder="e.g. 24"
            value={hoursBetween}
            onChange={e => setHoursBetween(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {HOUR_PRESETS.map(p => (
              <Button
                key={p.value}
                type="button"
                variant={hoursBetween === String(p.value) ? "default" : "outline"}
                size="sm"
                className={hoursBetween === String(p.value) ? "bg-cheese hover:bg-cheese-dark text-primary-foreground" : ""}
                onClick={() => setHoursBetween(String(p.value))}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Drip Completion Date */}
        <div className="space-y-2">
          <Label htmlFor="endDate" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Drip Completion Date
          </Label>
          <Input
            id="endDate"
            type="date"
            min={minDate}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>

        {/* Summary */}
        {summary && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-1">
            <p className="text-sm font-medium text-foreground">Drip Summary</p>
            <p className="text-sm text-muted-foreground">
              <span className="text-cheese font-semibold">{summary.totalPayments}</span> payments of{" "}
              <span className="text-cheese font-semibold">{payoutNum.toFixed(precision)} {tokenName}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Total deposit needed:{" "}
              <span className="text-cheese font-semibold">
                {summary.totalAmount.toFixed(precision)} {tokenName}
              </span>
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
          <AlertCircle className="h-5 w-5 text-cheese shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Two-Step Process</p>
            <p>
              Creating a drip is a two-step process: first the drip record is created on-chain,
              then the tokens are deposited to fund it. You'll sign two transactions.
            </p>
          </div>
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-3">
          <Checkbox id="terms-drip" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(v === true)} className="mt-0.5" />
          <label htmlFor="terms-drip" className="text-sm cursor-pointer leading-relaxed text-muted-foreground">
           I have read the{" "}
            <TermsDialog />
          </label>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleCreate}
          disabled={creating || !receiver || !payoutAmount || !tokenName || !tokenContract || !hoursBetween || !endDate || !termsAgreed}
          className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold"
          size="lg"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {step === 1 ? "Creating Drip..." : "Depositing Tokens..."}
            </>
          ) : (
            <>
              <Droplets className="h-4 w-4 mr-2" />
              Create Drip
            </>
          )}
        </Button>

        {/* Validation feedback */}
        {!creating && missingFields.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            <span>Missing: {missingFields.join(", ")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
