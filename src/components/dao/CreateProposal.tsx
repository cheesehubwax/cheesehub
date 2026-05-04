import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, X, Plus, Trash2, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DaoInfo, TreasuryNFT,
  buildCreateProposalAction, buildMultiOptionProposalAction,
  buildRankedChoiceProposalAction, buildTokenTransferProposalAction,
  buildNFTTransferProposalAction,
  buildAnnounceDepoAction, buildProposalCostAction,
  VOTING_TYPE_LABELS,
  findProposalFeeToken, getCachedFeeToken, rememberFeeToken, resolveTokenStats,
} from "@/lib/dao";
import { getTokenConfig } from "@/lib/tokenRegistry";
import { useEffect, useMemo } from "react";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";

interface CreateProposalProps {
  daoName: string;
  dao: DaoInfo;
  treasuryNFTs?: TreasuryNFT[];
  onClose: () => void;
  onCreated: () => void;
}

const WAX_TOKENS = [
  { symbol: "WAX", contract: "eosio.token", precision: 8 },
  { symbol: "CHEESE", contract: "cheese4token", precision: 4 },
  { symbol: "WAXDAO", contract: "token.waxdao", precision: 8 },
  { symbol: "TLM", contract: "alien.worlds", precision: 4 },
];

export function CreateProposal({ daoName, dao, treasuryNFTs = [], onClose, onCreated }: CreateProposalProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Resolve which contract to use to pay the DAO's proposal_cost token.
  const feeSymbol = useMemo(() => (dao.proposal_cost?.split(" ")[1] || "WAX"), [dao.proposal_cost]);
  const feeAmount = useMemo(() => parseFloat(dao.proposal_cost?.split(" ")[0] || "0"), [dao.proposal_cost]);
  const requiresFee = !!dao.proposal_cost && dao.proposal_cost !== "0" && feeAmount > 0;

  const presetContract =
    findProposalFeeToken(feeSymbol)?.contract
    ?? getCachedFeeToken(feeSymbol)?.contract
    ?? getTokenConfig(feeSymbol)?.contract
    ?? "";
  const [feeContract, setFeeContract] = useState<string>(presetContract);
  const [resolvingFee, setResolvingFee] = useState(false);

  // If we have a contract guess, verify it on chain (and cache).
  useEffect(() => {
    if (!requiresFee || !feeContract) return;
    let cancelled = false;
    (async () => {
      setResolvingFee(true);
      const stats = await resolveTokenStats(feeContract, feeSymbol);
      if (!cancelled && stats) rememberFeeToken(feeSymbol, feeContract, stats.precision);
      if (!cancelled) setResolvingFee(false);
    })();
    return () => { cancelled = true; };
  }, [requiresFee, feeContract, feeSymbol]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proposalType, setProposalType] = useState("1"); // 1=YNA, 2=MostVotes, 3=Ranked, 4=TokenTransfer, 5=NFTTransfer

  // Multi-option / Ranked Choice
  const [choices, setChoices] = useState(["Option A", "Option B"]);

  // Token Transfer
  const [tokenRecipient, setTokenRecipient] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);

  // NFT Transfer
  const [nftRecipient, setNftRecipient] = useState("");
  const [selectedNftIds, setSelectedNftIds] = useState<string[]>([]);

  const addChoice = () => setChoices(prev => [...prev, `Option ${String.fromCharCode(65 + prev.length)}`]);
  const removeChoice = (idx: number) => setChoices(prev => prev.filter((_, i) => i !== idx));

  const toggleNft = (id: string) => {
    setSelectedNftIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!session || !accountName) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Missing fields", description: "Title and description are required", variant: "destructive" });
      return;
    }

    setLoading(true);
    const actions = [];

    // Pay proposal cost if required
    if (requiresFee) {
      const ct = feeContract.trim().toLowerCase();
      if (!ct) {
        toast({
          title: "Token contract required",
          description: `Please specify the contract that issues ${feeSymbol} so the fee can be paid.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const stats = await resolveTokenStats(ct, feeSymbol);
      if (!stats) {
        toast({
          title: "Invalid token contract",
          description: `No ${feeSymbol} token found on contract "${ct}".`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      rememberFeeToken(feeSymbol, ct, stats.precision);
      actions.push(buildAnnounceDepoAction(accountName));
      actions.push(buildProposalCostAction(accountName, dao.proposal_cost, ct));
    }

    const type = parseInt(proposalType);
    switch (type) {
      case 1: // Yes/No/Abstain
        actions.push(buildCreateProposalAction(accountName, daoName, { title, description, proposalType: "4" }));
        break;
      case 2: // Most Votes Wins
        actions.push(buildMultiOptionProposalAction(accountName, daoName, { title, description, options: choices }));
        break;
      case 3: // Ranked Choice
        actions.push(buildRankedChoiceProposalAction(accountName, daoName, { title, description, options: choices }));
        break;
      case 4: { // Token Transfer
        const token = WAX_TOKENS[selectedTokenIdx];
        actions.push(buildTokenTransferProposalAction(accountName, daoName, {
          title, description,
          transfer: {
            recipient: tokenRecipient,
            amount: tokenAmount,
            tokenSymbol: token.symbol,
            tokenContract: token.contract,
          },
        }));
        break;
      }
      case 5: // NFT Transfer
        actions.push(buildNFTTransferProposalAction(accountName, daoName, {
          title, description,
          transfer: { recipient: nftRecipient, assetIds: selectedNftIds },
        }));
        break;
    }

    const result = await executeTransaction(actions, {
      successTitle: "Proposal Created! 🧀",
      successDescription: `"${title}" has been submitted`,
    });
    if (result.success) onCreated();
    setLoading(false);
  };

  return (
    <Card className="bg-card/60 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Create Proposal</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Proposal title" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your proposal..." rows={4} />
        </div>

        {/* Proposal Type Selector */}
        <div>
          <Label>Proposal Type</Label>
          <RadioGroup value={proposalType} onValueChange={setProposalType} className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {[
              { value: "1", label: "Yes/No/Abstain", desc: "Standard voting" },
              { value: "2", label: "Most Votes Wins", desc: "Custom options" },
              { value: "3", label: "Ranked Choice", desc: "Rank options" },
              { value: "4", label: "Token Transfer", desc: "Send tokens from treasury" },
              { value: "5", label: "NFT Transfer", desc: "Send NFTs from treasury" },
            ].map(opt => (
              <Label
                key={opt.value}
                htmlFor={`pt-${opt.value}`}
                className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                  proposalType === opt.value ? "border-primary/50 bg-primary/5" : "border-border/40 hover:border-border"
                }`}
              >
                <RadioGroupItem value={opt.value} id={`pt-${opt.value}`} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>

        {/* Multi-option choices */}
        {(proposalType === "2" || proposalType === "3") && (
          <div className="space-y-2">
            <Label>Choices</Label>
            {choices.map((c, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={c}
                  onChange={e => {
                    const next = [...choices];
                    next[idx] = e.target.value;
                    setChoices(next);
                  }}
                  placeholder={`Choice ${idx + 1}`}
                />
                {choices.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => removeChoice(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {choices.length < 10 && (
              <Button variant="outline" size="sm" onClick={addChoice}>
                <Plus className="h-4 w-4 mr-1" /> Add Choice
              </Button>
            )}
          </div>
        )}

        {/* Token Transfer fields */}
        {proposalType === "4" && (
          <div className="space-y-3 bg-muted/20 p-3 rounded-lg">
            <div>
              <Label>Recipient Account</Label>
              <Input value={tokenRecipient} onChange={e => setTokenRecipient(e.target.value)} placeholder="waxaccount" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Token</Label>
                <Select value={String(selectedTokenIdx)} onValueChange={v => setSelectedTokenIdx(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WAX_TOKENS.map((t, i) => (
                      <SelectItem key={t.symbol} value={String(i)}>{t.symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={tokenAmount} onChange={e => setTokenAmount(e.target.value)} placeholder="0.0" />
              </div>
            </div>
          </div>
        )}

        {/* NFT Transfer fields */}
        {proposalType === "5" && (
          <div className="space-y-3 bg-muted/20 p-3 rounded-lg">
            <div>
              <Label>Recipient Account</Label>
              <Input value={nftRecipient} onChange={e => setNftRecipient(e.target.value)} placeholder="waxaccount" />
            </div>
            <div>
              <Label>Select NFTs from Treasury ({selectedNftIds.length} selected)</Label>
              {treasuryNFTs.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No NFTs in treasury</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 mt-2 max-h-48 overflow-y-auto">
                  {treasuryNFTs.map(nft => (
                    <div
                      key={nft.asset_id}
                      className={`rounded border-2 cursor-pointer overflow-hidden transition-all ${
                        selectedNftIds.includes(nft.asset_id) ? "border-primary" : "border-border/40"
                      }`}
                      onClick={() => toggleNft(nft.asset_id)}
                    >
                      <div className="aspect-square bg-muted/30">
                        {nft.image && <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-[9px] truncate px-1">{nft.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Proposal Cost */}
        {requiresFee && (
          <div className="space-y-2 bg-muted/20 p-3 rounded">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 text-primary shrink-0" />
              Proposal cost: <span className="text-foreground font-medium">{dao.proposal_cost}</span>
              {resolvingFee && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
            </div>
            {!presetContract && (
              <div>
                <Label className="text-xs">Token contract for {feeSymbol}</Label>
                <Input
                  value={feeContract}
                  onChange={e => setFeeContract(e.target.value.toLowerCase().replace(/[^a-z1-5.]/g, "").slice(0, 12))}
                  placeholder="e.g. mytoken.acc"
                  maxLength={12}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  This DAO uses a custom fee token. Enter the contract that issues {feeSymbol}.
                </p>
              </div>
            )}
          </div>
        )}

        <Button onClick={handleSubmit} disabled={loading} className="w-full bg-primary text-primary-foreground">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "Submit Proposal"}
        </Button>
      </CardContent>
    </Card>
  );
}
