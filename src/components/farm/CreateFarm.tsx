import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Sprout } from "lucide-react";
import { FARM_CREATION_FEES, validateFarmName, buildFarmCreationFeeWaxAction, buildAssertPointAction, PAYOUT_INTERVALS } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";

export function CreateFarm() {
  const { accountName, isConnected } = useWax();
  const { transact, loading } = useWaxTransaction();
  const { toast } = useToast();

  const [farmName, setFarmName] = useState("");
  const [rewardContract, setRewardContract] = useState("cheeseburger");
  const [rewardSymbol, setRewardSymbol] = useState("4,CHEESE");
  const [payoutInterval, setPayoutInterval] = useState("86400");
  const [paymentMethod, setPaymentMethod] = useState<"wax" | "cheese">("wax");

  const validation = validateFarmName(farmName);

  const handleCreate = async () => {
    if (!accountName) return;
    if (!validation.valid) {
      toast({ title: "Invalid farm name", description: validation.error, variant: "destructive" });
      return;
    }

    const actions = [];

    if (paymentMethod === "wax") {
      actions.push(buildAssertPointAction(accountName));
      actions.push(buildFarmCreationFeeWaxAction(accountName));
    }

    actions.push({
      account: "farms.waxdao",
      name: "createfarm",
      authorization: [{ actor: accountName, permission: "active" }],
      data: {
        user: accountName,
        farmname: farmName,
        reward_token: {
          contract: rewardContract,
          sym: rewardSymbol,
        },
        hours_between_payouts: parseInt(payoutInterval) / 3600,
      },
    });

    const result = await transact(actions);
    if (result.success) {
      toast({ title: "Farm Created! 🌱", description: `${farmName} has been created` });
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Connect your wallet to create a farm</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="bg-card/60 border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create New Farm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Farm Name (1-12 chars, a-z, 1-5, .)</Label>
            <Input
              value={farmName}
              onChange={(e) => setFarmName(e.target.value.toLowerCase())}
              placeholder="myfarm"
              maxLength={12}
            />
            {farmName && !validation.valid && (
              <p className="text-sm text-destructive mt-1">{validation.error}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Reward Token Contract</Label>
              <Input value={rewardContract} onChange={(e) => setRewardContract(e.target.value)} placeholder="cheeseburger" />
            </div>
            <div>
              <Label>Reward Token (precision,SYMBOL)</Label>
              <Input value={rewardSymbol} onChange={(e) => setRewardSymbol(e.target.value)} placeholder="4,CHEESE" />
            </div>
          </div>

          <div>
            <Label>Payout Interval</Label>
            <Select value={payoutInterval} onValueChange={setPayoutInterval}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYOUT_INTERVALS.map(interval => (
                  <SelectItem key={interval.value} value={String(interval.value)}>
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FeePaymentSelector
            selectedMethod={paymentMethod}
            onMethodChange={setPaymentMethod}
            onCheeseAmountChange={() => {}}
          />

          <Button onClick={handleCreate} disabled={loading || !validation.valid} className="w-full bg-primary text-primary-foreground" size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating Farm...</> : "Create Farm (250 WAX)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
