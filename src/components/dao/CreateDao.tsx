import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Users } from "lucide-react";
import { DAO_TYPES, PROPOSER_TYPES, buildDaoCreationFeeAction, buildAssertPointAction } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";

export function CreateDao() {
  const { accountName, session, isConnected } = useWax();
  const { transact, loading } = useWaxTransaction();
  const { toast } = useToast();

  const [daoName, setDaoName] = useState("");
  const [daoType, setDaoType] = useState("5");
  const [proposerType, setProposerType] = useState("1");
  const [tokenContract, setTokenContract] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [threshold, setThreshold] = useState(50);
  const [hoursPerProposal, setHoursPerProposal] = useState(72);
  const [minimumVotes, setMinimumVotes] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"wax" | "cheese">("wax");

  const handleCreate = async () => {
    if (!session || !accountName) return;

    if (!daoName.trim() || !/^[a-z1-5.]{1,12}$/.test(daoName)) {
      toast({ title: "Invalid DAO name", description: "Must be 1-12 chars, a-z, 1-5, and .", variant: "destructive" });
      return;
    }

    const actions = [];

    // Pay creation fee
    if (paymentMethod === "wax") {
      actions.push(buildAssertPointAction(accountName));
      actions.push(buildDaoCreationFeeAction(accountName));
    }

    // Create DAO action
    actions.push({
      account: "dao.waxdao",
      name: "createdao",
      authorization: [{ actor: accountName, permission: "active" }],
      data: {
        user: accountName,
        daoname: daoName,
        dao_type: parseInt(daoType),
        proposer_type: parseInt(proposerType),
        gov_token_contract: tokenContract || "eosio.token",
        gov_token_symbol: tokenSymbol || "8,WAX",
        threshold: threshold,
        hours_per_proposal: hoursPerProposal,
        minimum_weight: "0",
        minimum_votes: minimumVotes,
        proposal_cost: "0.00000000 WAX",
        authors: [accountName],
        gov_schemas: [],
      },
    });

    const result = await transact(actions);
    if (result.success) {
      toast({ title: "DAO Created! 🧀🏛️", description: `${daoName} has been created` });
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Connect your wallet to create a DAO</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="bg-card/60 border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create New DAO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>DAO Name (1-12 chars, a-z, 1-5, .)</Label>
            <Input value={daoName} onChange={(e) => setDaoName(e.target.value.toLowerCase())} placeholder="mydao" maxLength={12} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>DAO Type</Label>
              <Select value={daoType} onValueChange={setDaoType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DAO_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Who Can Propose</Label>
              <Select value={proposerType} onValueChange={setProposerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROPOSER_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Governance Token Contract</Label>
              <Input value={tokenContract} onChange={(e) => setTokenContract(e.target.value)} placeholder="eosio.token" />
            </div>
            <div>
              <Label>Token Symbol (precision,SYMBOL)</Label>
              <Input value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} placeholder="8,WAX" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Threshold %</Label>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) || 50)} min={1} max={100} />
            </div>
            <div>
              <Label>Hours Per Proposal</Label>
              <Input type="number" value={hoursPerProposal} onChange={(e) => setHoursPerProposal(parseInt(e.target.value) || 72)} min={1} />
            </div>
            <div>
              <Label>Min Votes</Label>
              <Input type="number" value={minimumVotes} onChange={(e) => setMinimumVotes(parseInt(e.target.value) || 1)} min={1} />
            </div>
          </div>

          <FeePaymentSelector
            feeType="dao"
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />

          <Button onClick={handleCreate} disabled={loading} className="w-full bg-primary text-primary-foreground" size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating DAO...</> : "Create DAO (250 WAX)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
