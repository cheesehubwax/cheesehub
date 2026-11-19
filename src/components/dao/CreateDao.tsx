import { explorerAccount } from '@/lib/explorer';
import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Loader2, Plus, Users, AlertTriangle, ChevronDown, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CREATABLE_DAO_TYPES, PROPOSER_TYPES, DaoSocials } from "@/lib/dao";
import { buildCreateDaoTransaction, checkAuthorCandidate, checkDaoName, checkGovSchemas } from "@/lib/daoCreate";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { ProposalFeeInput, ProposalFeeValue } from "@/components/dao/ProposalFeeInput";
import { GovSchemaRow, GovSchemaCheck } from "@/components/dao/GovSchemaRow";
import { useCheeseFeePricing } from "@/hooks/useCheeseFeePricing";
import { useWaxdaoFeePricing } from "@/hooks/useWaxdaoFeePricing";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";
import { SectionHeader, FieldHint, InfoTooltip } from "@/components/dao/CreateDaoFormBits";
import { CreateDaoHelpDialog } from "@/components/dao/CreateDaoHelpDialog";


export function CreateDao() {
  const { accountName, session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const cheesePricing = useCheeseFeePricing();
  const waxdaoPricing = useWaxdaoFeePricing();
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(true);
  const { toast } = useToast();

  const [daoName, setDaoName] = useState("");
  const [daoType, setDaoType] = useState(4);
  const [proposerType, setProposerType] = useState("1");
  const [authors, setAuthors] = useState<string[]>([]);
  const [authorInput, setAuthorInput] = useState("");
  const [tokenContract, setTokenContract] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [threshold, setThreshold] = useState(50);
  const [hoursPerProposal, setHoursPerProposal] = useState(72);
  const [minimumVotes, setMinimumVotes] = useState(1);
  const [minimumWeight, setMinimumWeight] = useState(0);
  const [feeToken, setFeeToken] = useState<ProposalFeeValue>({
    amount: 0, symbol: "WAX", contract: "eosio.token", precision: 8,
  });
  const [paymentMethod, setPaymentMethod] = useState<"wax" | "cheese" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpAccordionValue, setHelpAccordionValue] = useState<string[]>([]);
  const [scrollToAnchor, setScrollToAnchor] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Profile fields
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [socials, setSocials] = useState<DaoSocials>({});

  // Gov schemas for NFT-based DAOs
  const [govSchemas, setGovSchemas] = useState<{ collection_name: string; schema_name: string }[]>([
    { collection_name: "", schema_name: "" },
  ]);
  const [schemaStatuses, setSchemaStatuses] = useState<GovSchemaCheck[]>(["idle"]);

  useEffect(() => {
    if (scrollToAnchor && helpOpen && anchorRef.current) {
      setTimeout(() => {
        anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setScrollToAnchor(false);
      }, 150);
    }
  }, [scrollToAnchor, helpOpen]);

  const addSchema = () => {
    setGovSchemas(prev => [...prev, { collection_name: "", schema_name: "" }]);
    setSchemaStatuses(prev => [...prev, "idle"]);
  };
  const removeSchema = (idx: number) => {
    setGovSchemas(prev => prev.filter((_, i) => i !== idx));
    setSchemaStatuses(prev => prev.filter((_, i) => i !== idx));
  };
  const updateSchema = (idx: number, field: "collection_name" | "schema_name", value: string) => {
    setGovSchemas(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const updateSchemaStatus = (idx: number, status: GovSchemaCheck) => {
    setSchemaStatuses(prev => prev.map((s, i) => (i === idx ? status : s)));
  };

  const daoTypeDescriptions: Record<number, string> = {
    4: "Members stake governance tokens directly to the DAO contract. Tokens are held custodially, and unstaking lets you reclaim them immediately. The token's precision must match.",
    5: "NFTs stay in user's wallets — no staking required! Simply hold eligible NFTs to cast. Hold NFT = 1 vote — best suited for fair NFT communities.",
  };

  const needsSchemas = [1, 2, 5].includes(daoType);
  const needsToken = daoType === 4;

  const addAuthor = () => {
    const result = checkAuthorCandidate(authorInput, accountName, authors);
    if (result.kind === "empty") return;
    if (result.kind === "rejected") {
      toast(result.toast);
      return;
    }
    setAuthors([...authors, result.account]);
    setAuthorInput("");
  };

  const handleCreate = async () => {
    if (!session || !accountName) return;

    if (!paymentMethod) {
      toast({ title: "Select payment method", description: "Choose CHEESE or WAX to pay the creation fee.", variant: "destructive" });
      return;
    }

    const nameError = checkDaoName(daoName);
    if (nameError) {
      toast({ ...nameError, variant: "destructive" });
      return;
    }

    if (needsSchemas) {
      const schemaError = checkGovSchemas(govSchemas, schemaStatuses, accountName);
      if (schemaError) {
        toast({ ...schemaError, variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    const actions = buildCreateDaoTransaction({
      accountName, paymentMethod, daoName, daoType, needsToken, needsSchemas,
      tokenContract, tokenSymbol, govSchemas, threshold, hoursPerProposal, minimumWeight, minimumVotes,
      proposerType, authors, proposalCost: feeToken.amount,
      description, avatar, coverImage, socials,
      cheese: { isAvailable: cheesePricing.isAvailable, formattedForTx: cheesePricing.formattedForTx },
      waxdao: { isAvailable: waxdaoPricing.isAvailable, formattedForTx: waxdaoPricing.formattedForTx },
    });

    await executeTransaction(actions, {
      successTitle: "DAO Created! ",
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
            <OpenMojiIcon emoji="🏛️" size={18} className="text-primary" /> Create a New DAO
            <CreateDaoHelpDialog
              open={helpOpen}
              onOpenChange={(open) => {
                setHelpOpen(open);
                if (!open) {
                  setHelpAccordionValue([]);
                  setScrollToAnchor(false);
                }
              }}
              accordionValue={helpAccordionValue}
              onAccordionValueChange={setHelpAccordionValue}
              anchorRef={anchorRef}
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            Set up your decentralized autonomous organization on the WAX blockchain.
          </p>
          <p className="text-xs text-muted-foreground">Pay with CHEESE (20% discount) or 265 WAX to create a DAO.</p>
        </div>

        {/* DAO TYPE */}
        <div className="space-y-3">
          <SectionHeader>DAO Type</SectionHeader>
          <RadioGroup
            value={String(daoType)}
            onValueChange={v => setDaoType(parseInt(v))}
            className="space-y-2"
          >
            {Object.entries(CREATABLE_DAO_TYPES).map(([key, label]) => {
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
              <p className="text-xs text-muted-foreground">
                You must be an authorized account on every collection listed below. The <code className="bg-muted px-1 rounded">dao.waxdao</code> contract verifies this on-chain and will reject creation otherwise. Ask the collection owner to add you via <code className="bg-muted px-1 rounded">addcolauth</code> if needed.
              </p>
              {govSchemas.map((s, i) => (
                <GovSchemaRow
                  key={i}
                  collection={s.collection_name}
                  schema={s.schema_name}
                  creator={accountName ?? ""}
                  onChange={(field, val) => updateSchema(i, field, val)}
                  onRemove={govSchemas.length > 1 ? () => removeSchema(i) : undefined}
                  onStatusChange={(status) => updateSchemaStatus(i, status)}
                />
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
                  <InfoTooltip text="Voting power is measured in tokens (or NFTs), not people. One member with lots of tokens can outweigh many members with a few." />
                </Label>
                <Input
                  type="number"
                  value={minimumWeight}
                  onChange={e => setMinimumWeight(parseInt(e.target.value) || 0)}
                  min={0}
                  className="mt-1"
                />
                <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground space-y-1">
                  <p><span className="font-semibold text-foreground">Counted in {needsToken ? "tokens" : "NFTs"}, not members.</span> A vote's weight is how many {needsToken ? "governance tokens the voter has staked" : "qualifying NFTs the voter holds"}.</p>
                  <p>Every proposal also needs at least <span className="font-semibold text-foreground">1 whole {needsToken ? "token" : "NFT"}</span> of total votes cast to count. If the votes add up to less, it ends as <span className="font-semibold text-foreground">Quorum Not Met</span> and nothing is sent from the treasury, even when everyone voted Yes.{needsToken ? " Example: two members voting with 0.1 WAX staked each is only 0.2 WAX, which is not enough." : ""}</p>
                </div>
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

              {proposerType === "0" && (
                <div>
                  <Label className="text-sm font-medium">
                    Authorized Authors
                    <InfoTooltip text="WAX accounts allowed to create proposals. The creator is included automatically. Cannot be changed after DAO creation." />
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="wax.account"
                      value={authorInput}
                      maxLength={12}
                      onChange={e => setAuthorInput(e.target.value.toLowerCase())}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAuthor();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAuthor}
                    >
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-primary/10 border border-primary/30 text-foreground">
                      {accountName || "creator"} <span className="text-[10px] text-muted-foreground">(creator)</span>
                    </span>
                    {authors.map(a => (
                      <span key={a} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-muted border border-border/50">
                        {a}
                        <button
                          type="button"
                          onClick={() => setAuthors(authors.filter(x => x !== a))}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${a}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <FieldHint>
                    The creator is automatically included. Add any additional accounts allowed to create proposals.{" "}
                    <span className="text-cheese">Authors cannot be changed after creation.</span>
                  </FieldHint>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">
                  Proposal Submission Fee
                  <InfoTooltip text="WAX fee required to submit a proposal. Set amount to 0 for free proposals. The contract requires WAX." />
                </Label>
                <div className="mt-1">
                  <ProposalFeeInput value={feeToken} onChange={setFeeToken} />
                </div>
                <FieldHint>
                  Submission fees are paid in WAX. Set amount to 0 for free proposals.
                </FieldHint>
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
            <span className="font-semibold text-foreground">Anchor Wallet Users:</span> This transaction includes inline actions and may trigger a "Dangerous Transaction" warning. This is normal and safe — see the{" "}
            <button
              type="button"
              onClick={() => {
                setHelpAccordionValue(["anchor"]);
                setScrollToAnchor(true);
                setHelpOpen(true);
              }}
              className="text-primary hover:underline inline"
            >
              help guide
            </button>
            {" "}for instructions on how to allow it.
          </p>
        </div>


        {/* Submit */}
        <Button onClick={handleCreate} disabled={loading || !paymentMethod || !termsAgreed} className="w-full bg-primary text-primary-foreground" size="lg">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating DAO...</> : paymentMethod === "cheese" ? <><OpenMojiIcon emoji="🏛️" size={18} /> Create DAO (Pay with CHEESE)</> : paymentMethod === "wax" ? <><OpenMojiIcon emoji="🏛️" size={18} /> Create DAO (265 WAX)</> : <><OpenMojiIcon emoji="🏛️" size={18} /> Select Payment Method</>}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by the{" "}
          <a href={explorerAccount('dao.waxdao')} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            DAO.WAXDAO
          </a>
          {" "}smart contract
        </p>
      </div>
    </TooltipProvider>
  );
}
