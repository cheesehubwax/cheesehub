import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Loader2, Plus, Users, Trash2, AlertTriangle, HelpCircle, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  DAO_TYPES, PROPOSER_TYPES,
  buildAssertPointAction, buildDaoCreationFeeAction, buildCreateDaoAction,
  buildSetProfileActionWithSocials, DaoSocials,
} from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold tracking-wide uppercase text-primary">{children}</h3>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

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
    4: "Members stake governance tokens directly to the DAO contract. Tokens are held custodially, and unstaking lets you reclaim them immediately. The token's precision must match.",
    5: "NFTs stay in user's wallets — no staking required! Simply hold eligible NFTs to cast. Hold NFT = 1 vote — best suited for fair NFT communities.",
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

    if (paymentMethod === "wax") {
      actions.push(buildAssertPointAction(accountName));
      actions.push(buildDaoCreationFeeAction(accountName));
    }

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

    if (description || avatar || coverImage || Object.values(socials).some(v => v)) {
      actions.push(buildSetProfileActionWithSocials(
        accountName, daoName, description, avatar, coverImage, socials
      ));
    }

    await executeTransaction(actions, {
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
    <TooltipProvider>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-primary">🏛️</span> Create a New DAO
            <a href="https://docs.waxdao.io" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-2">
              ask me for help
            </a>
          </h2>
          <p className="text-sm text-muted-foreground">
            Set up your decentralized autonomous organization on the WAX blockchain.
          </p>
          <p className="text-xs text-muted-foreground">It costs 265 WAX to create a DAO.</p>
        </div>

        {/* DAO TYPE */}
        <div className="space-y-3">
          <SectionHeader>DAO Type</SectionHeader>
          <RadioGroup
            value={String(daoType)}
            onValueChange={v => setDaoType(parseInt(v))}
            className="space-y-2"
          >
            {Object.entries(DAO_TYPES).map(([key, label]) => {
              const isSelected = daoType === parseInt(key);
              return (
                <Label
                  key={key}
                  htmlFor={`dt-${key}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/40 hover:border-border"
                  }`}
                >
                  <RadioGroupItem value={key} id={`dt-${key}`} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{daoTypeDescriptions[parseInt(key)]}</p>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        </div>

        {/* BASIC INFORMATION */}
        <div className="space-y-4">
          <SectionHeader>Basic Information</SectionHeader>

          <div>
            <Label className="text-sm font-medium">DAO Name <span className="text-destructive">*</span></Label>
            <Input
              value={daoName}
              onChange={e => setDaoName(e.target.value.toLowerCase())}
              placeholder="e.g., cheesedao"
              maxLength={12}
              className="mt-1"
            />
            <FieldHint>Max 12 characters. lowercase letters and numbers only (WAX account name format)</FieldHint>
          </div>

          <div>
            <Label className="text-sm font-medium">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your DAO's purpose and goals..."
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Avatar (IPFS Hash)</Label>
              <Input
                value={avatar}
                onChange={e => setAvatar(e.target.value)}
                placeholder="e.g., QmHash..."
                className="mt-1"
              />
              <FieldHint>Small image (300x300). IPFS hash only</FieldHint>
            </div>
            <div>
              <Label className="text-sm font-medium">Cover Image (IPFS Hash)</Label>
              <Input
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                placeholder="e.g., QmHash..."
                className="mt-1"
              />
              <FieldHint>Large horizontal image. IPFS hash only</FieldHint>
            </div>
          </div>

          {/* Social Links collapsible */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-sm h-9 border-border/40">
                Social Links (Optional)
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                {(["twitter", "discord", "telegram", "website"] as const).map(key => (
                  <div key={key}>
                    <Label className="text-xs capitalize">{key}</Label>
                    <Input
                      value={socials[key] || ""}
                      onChange={e => setSocials(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`${key} URL`}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* GOVERNANCE TOKEN (conditional) */}
        {needsToken && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-5 space-y-4">
              <SectionHeader>Governance Token</SectionHeader>
              <div>
                <Label className="text-sm font-medium">Token Contract <span className="text-destructive">*</span></Label>
                <Input
                  value={tokenContract}
                  onChange={e => setTokenContract(e.target.value)}
                  placeholder="e.g., cheesetoken"
                  className="mt-1"
                />
                <FieldHint>The smart contract that issued your governance token</FieldHint>
              </div>
              <div>
                <Label className="text-sm font-medium">Token Symbol <span className="text-destructive">*</span></Label>
                <Input
                  value={tokenSymbol}
                  onChange={e => setTokenSymbol(e.target.value)}
                  placeholder="e.g., 8,CHEESE"
                  className="mt-1"
                />
                <FieldHint>Format: precision,SYMBOL (e.g., 8,CHEESE)</FieldHint>
              </div>
            </CardContent>
          </Card>
        )}

        {/* GOV SCHEMAS (conditional for NFT types) */}
        {needsSchemas && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-5 space-y-3">
              <SectionHeader>Governance NFT Schemas</SectionHeader>
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
            </CardContent>
          </Card>
        )}

        {/* ADVANCED SETTINGS */}
        <div className="space-y-5">
          <SectionHeader>Advanced Settings</SectionHeader>

          {/* Voting Rules */}
          <Card className="bg-card/60 border-border/40">
            <CardContent className="pt-5 space-y-5">
              <h4 className="text-sm font-semibold text-foreground">Voting Rules</h4>

              {/* Threshold slider */}
              <div>
                <Label className="text-sm font-medium">
                  Pass Threshold (%)
                  <InfoTooltip text="Percentage of votes required for a proposal to pass" />
                </Label>
                <div className="mt-3 px-1">
                  <Slider
                    value={[threshold]}
                    onValueChange={([v]) => setThreshold(v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span className="text-foreground font-medium">{threshold}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Min vote weight */}
              <div>
                <Label className="text-sm font-medium">
                  Minimum Vote Weight
                  <InfoTooltip text="Minimum total vote weight required for a proposal to be valid" />
                </Label>
                <Input
                  type="number"
                  value={minimumWeight}
                  onChange={e => setMinimumWeight(parseInt(e.target.value) || 0)}
                  min={0}
                  className="mt-1"
                />
              </div>

              {/* Voting duration */}
              <div>
                <Label className="text-sm font-medium">
                  Voting Duration (hours)
                  <InfoTooltip text="How long voting stays open for each proposal" />
                </Label>
                <Input
                  type="number"
                  value={hoursPerProposal}
                  onChange={e => setHoursPerProposal(parseInt(e.target.value) || 72)}
                  min={1}
                  className="mt-1"
                />
                <FieldHint>72 hours = 3.0 days</FieldHint>
              </div>
            </CardContent>
          </Card>

          {/* Proposal Permissions */}
          <Card className="bg-card/60 border-border/40">
            <CardContent className="pt-5 space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Proposal Permissions</h4>

              <div>
                <Label className="text-sm font-medium">
                  Who Can Create Proposals?
                  <InfoTooltip text="Controls who is allowed to submit new proposals to the DAO" />
                </Label>
                <RadioGroup
                  value={proposerType}
                  onValueChange={setProposerType}
                  className="space-y-2 mt-2"
                >
                  {Object.entries(PROPOSER_TYPES).map(([key, label]) => {
                    const descriptions: Record<string, string> = {
                      "0": "Only specific authors you authorize can create proposals.",
                      "1": "Any WAX wallet can create proposals. Most open and democratic option.",
                      "2": "Must hold a minimum amount of governance tokens to create proposals.",
                    };
                    return (
                      <Label
                        key={key}
                        htmlFor={`pt-${key}`}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          proposerType === key
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/40 hover:border-border"
                        }`}
                      >
                        <RadioGroupItem value={key} id={`pt-${key}`} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{descriptions[key]}</p>
                        </div>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Proposal Submission Fee (WAX)
                  <InfoTooltip text="WAX fee required to submit a proposal. Set to 0 for free proposals." />
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    value={proposalCost}
                    onChange={e => setProposalCost(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">WAX</span>
                </div>
                <FieldHint>Set to 0 for free proposals.</FieldHint>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fee Payment */}
        <FeePaymentSelector
          selectedMethod={paymentMethod}
          onMethodChange={setPaymentMethod}
          onCheeseAmountChange={() => {}}
        />

        {/* Warning */}
        <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-foreground">Another Wallet Store:</span> This transaction includes inline actions and may trigger a "Dangerous Transaction" warning. This is normal and safe — see the{" "}
            <a href="https://docs.waxdao.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">help guide</a>
            {" "}page for instructions on how to allow it.
          </p>
        </div>

        {/* Submit */}
        <Button onClick={handleCreate} disabled={loading} className="w-full bg-primary text-primary-foreground" size="lg">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating DAO...</> : "🏛️ Create DAO (265 WAX)"}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by the{" "}
          <a href="https://waxblock.io/account/dao.waxdao" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            DAO.WAXDAO
          </a>
          {" "}smart contract
        </p>
      </div>
    </TooltipProvider>
  );
}
