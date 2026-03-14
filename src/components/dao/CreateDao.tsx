import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Users, Trash2, Info, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DAO_TYPES, PROPOSER_TYPES,
  buildAssertPointAction, buildDaoCreationFeeAction, buildCreateDaoAction,
  buildSetProfileActionWithSocials, DaoSocials,
} from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";

export function CreateDao() {
  const { accountName, session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [daoName, setDaoName] = useState("");
  const [daoType, setDaoType] = useState(4);
  const [proposerType, setProposerType] = useState("1");
  const [tokenContract, setTokenContract] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [threshold, setThreshold] = useState(50);
  const [hoursPerProposal, setHoursPerProposal] = useState(72);
  const [minimumVotes, setMinimumVotes] = useState(1);
  const [minimumWeight, setMinimumWeight] = useState(0);
  const [proposalCost, setProposalCost] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"wax" | "cheese">("wax");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Profile fields
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [socials, setSocials] = useState<DaoSocials>({});

  // Gov schemas for NFT-based DAOs
  const [govSchemas, setGovSchemas] = useState<{ collection_name: string; schema_name: string }[]>([
    { collection_name: "", schema_name: "" },
  ]);

  const addSchema = () => setGovSchemas(prev => [...prev, { collection_name: "", schema_name: "" }]);
  const removeSchema = (idx: number) => setGovSchemas(prev => prev.filter((_, i) => i !== idx));
  const updateSchema = (idx: number, field: "collection_name" | "schema_name", value: string) => {
    setGovSchemas(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const daoTypeDescriptions: Record<number, string> = {
    1: "Users stake NFTs to the DAO contract to gain voting power.",
    2: "Users stake tokens to a WaxDAO pool for voting.",
    3: "Uses an existing WaxDAO staking pool for governance.",
    4: "Users stake governance tokens directly to the DAO contract.",
    5: "Non-custodial — users just hold eligible NFTs in their wallet.",
  };

  const needsSchemas = [1, 2, 5].includes(daoType);
  const needsToken = daoType === 4;

  const handleCreate = async () => {
    if (!session || !accountName) return;

    if (!daoName.trim() || !/^[a-z1-5.]{1,12}$/.test(daoName)) {
      toast({ title: "Invalid DAO name", description: "Must be 1-12 chars, a-z, 1-5, and .", variant: "destructive" });
      return;
    }

    setLoading(true);
    const actions = [];

    // Pay creation fee
    if (paymentMethod === "wax") {
      actions.push(buildAssertPointAction(accountName));
      actions.push(buildDaoCreationFeeAction(accountName));
    }

    // Create DAO
    actions.push(buildCreateDaoAction(accountName, {
      daoName,
      daoType,
      tokenContract: needsToken ? tokenContract : undefined,
      tokenSymbol: needsToken ? tokenSymbol : undefined,
      govSchemas: needsSchemas ? govSchemas.filter(s => s.collection_name && s.schema_name) : undefined,
      threshold,
      hoursPerProposal,
      minimumWeight,
      minimumVotes,
      proposerType: parseInt(proposerType),
      authors: [accountName],
      proposalCost,
    }));

    // Set profile if any profile fields are filled
    if (description || avatar || coverImage || Object.values(socials).some(v => v)) {
      actions.push(buildSetProfileActionWithSocials(
        accountName, daoName, description, avatar, coverImage, socials
      ));
    }

    const result = await executeTransaction(actions, {
      successTitle: "DAO Created! 🧀🏛️",
      successDescription: `${daoName} has been created on WaxDAO`,
    });
    setLoading(false);
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
        <CardContent className="space-y-5">
          {/* DAO Name */}
          <div>
            <Label>DAO Name (1-12 chars, a-z, 1-5, .)</Label>
            <Input value={daoName} onChange={e => setDaoName(e.target.value.toLowerCase())} placeholder="mydao" maxLength={12} />
          </div>

          {/* DAO Type Selector */}
          <div>
            <Label className="mb-2 block">DAO Type</Label>
            <RadioGroup
              value={String(daoType)}
              onValueChange={v => setDaoType(parseInt(v))}
              className="grid gap-2"
            >
              {Object.entries(DAO_TYPES).map(([key, label]) => (
                <Label
                  key={key}
                  htmlFor={`dt-${key}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    daoType === parseInt(key)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/40 hover:border-border"
                  }`}
                >
                  <RadioGroupItem value={key} id={`dt-${key}`} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{daoTypeDescriptions[parseInt(key)]}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Type-specific fields */}
          {needsToken && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Governance Token Contract</Label>
                <Input value={tokenContract} onChange={e => setTokenContract(e.target.value)} placeholder="eosio.token" />
              </div>
              <div>
                <Label>Token Symbol (precision,SYMBOL)</Label>
                <Input value={tokenSymbol} onChange={e => setTokenSymbol(e.target.value)} placeholder="8,WAX" />
              </div>
            </div>
          )}

          {needsSchemas && (
            <div className="space-y-2">
              <Label>Governance Schemas (collection + schema pairs)</Label>
              {govSchemas.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Collection name"
                    value={s.collection_name}
                    onChange={e => updateSchema(i, "collection_name", e.target.value)}
                  />
                  <Input
                    placeholder="Schema name"
                    value={s.schema_name}
                    onChange={e => updateSchema(i, "schema_name", e.target.value)}
                  />
                  {govSchemas.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeSchema(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSchema}>
                <Plus className="h-4 w-4 mr-1" /> Add Schema
              </Button>
            </div>
          )}

          {/* Core Settings */}
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <Label>Threshold %</Label>
              <Input type="number" value={threshold} onChange={e => setThreshold(parseInt(e.target.value) || 50)} min={1} max={100} />
            </div>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm">
                Advanced Settings
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Hours Per Proposal</Label>
                  <Input type="number" value={hoursPerProposal} onChange={e => setHoursPerProposal(parseInt(e.target.value) || 72)} min={1} />
                </div>
                <div>
                  <Label>Min Votes</Label>
                  <Input type="number" value={minimumVotes} onChange={e => setMinimumVotes(parseInt(e.target.value) || 1)} min={1} />
                </div>
                <div>
                  <Label>Min Weight</Label>
                  <Input type="number" value={minimumWeight} onChange={e => setMinimumWeight(parseInt(e.target.value) || 0)} min={0} />
                </div>
              </div>
              <div>
                <Label>Proposal Cost (WAX, 0 = free)</Label>
                <Input type="number" value={proposalCost} onChange={e => setProposalCost(parseFloat(e.target.value) || 0)} min={0} step={0.01} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Profile Setup */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm">
                Profile & Social Links (Optional)
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="DAO description..." rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Avatar (IPFS hash or URL)</Label>
                  <Input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="QmHash..." />
                </div>
                <div>
                  <Label>Cover Image</Label>
                  <Input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="QmHash..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["twitter", "discord", "telegram", "website"] as const).map(key => (
                  <div key={key}>
                    <Label className="text-xs capitalize">{key}</Label>
                    <Input
                      value={socials[key] || ""}
                      onChange={e => setSocials(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`${key} URL`}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Fee Payment */}
          <FeePaymentSelector
            selectedMethod={paymentMethod}
            onMethodChange={setPaymentMethod}
            onCheeseAmountChange={() => {}}
          />

          <Button onClick={handleCreate} disabled={loading} className="w-full bg-primary text-primary-foreground" size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating DAO...</> : "Create DAO (265 WAX)"}
          </Button>

          {/* FAQ */}
          <Accordion type="single" collapsible className="text-sm">
            <AccordionItem value="types">
              <AccordionTrigger className="text-xs">What are the DAO types?</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                {Object.entries(DAO_TYPES).map(([k, v]) => (
                  <p key={k}><strong>Type {k}:</strong> {v} — {daoTypeDescriptions[parseInt(k)]}</p>
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cost">
              <AccordionTrigger className="text-xs">How much does it cost?</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground">
                Creating a DAO costs 265 WAX. You can pay with CHEESE for a 20% discount.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
