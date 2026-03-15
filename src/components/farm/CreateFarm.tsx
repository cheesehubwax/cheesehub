import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Sprout, Trash2, ChevronDown, AlertTriangle } from "lucide-react";
import {
  FARM_CREATION_FEES, validateFarmName, FARM_TYPE_LABELS, FarmType,
  buildCreateFarmAction, buildAssertPointAction, buildFarmCreationFeeWaxAction,
  RewardToken,
} from "@/lib/farm";
import {
  buildCheesePaymentAction, buildWaxPaymentAction, buildWaxdaoFeeAction,
  WAX_FEE_AMOUNT,
} from "@/lib/cheeseFees";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useCheeseFeePricing } from "@/hooks/useCheeseFeePricing";
import { useWaxdaoFeePricing } from "@/hooks/useWaxdaoFeePricing";
import { useToast } from "@/hooks/use-toast";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";

const FARM_TYPE_OPTIONS: { value: FarmType; label: string }[] = [
  { value: "collections", label: "Collections" },
  { value: "schemas", label: "Schemas" },
  { value: "templates", label: "Templates" },
  { value: "attributes", label: "Attributes" },
];

const FAQ_ITEMS = [
  {
    question: "Can I pay with CHEESE tokens?",
    answer: "Yes! You can pay with CHEESE tokens and receive a 20% discount on the creation fee. Simply select the CHEESE option and the transaction will handle the conversion automatically in a single step.",
  },
  {
    question: "What is the correct format for my farm name?",
    answer: "Farm names must be 12 characters or less and can only contain lowercase letters (a-z), numbers (1-5), and periods. Names cannot start or end with a period, and cannot contain consecutive periods.",
  },
  {
    question: "How much does it cost to create a farm?",
    answer: "You can create a farm by paying 265 WAX, 25,000 WAXDAO tokens, or by using 1 NFT from the Wojak collection (ourwojaksart). These payment options help support the WaxDAO ecosystem.",
  },
  {
    question: "What are the different farm types?",
    answer: "Collections: stake any NFT from specified collections. Schemas: stake NFTs from specific schemas within collections. Templates: stake specific template IDs. Attributes: stake NFTs with matching attribute key/value pairs.",
  },
  {
    question: "How do I add stakable assets after creation?",
    answer: "After creating your farm, you need to add stakable assets (collections, schemas, templates, or attributes) using separate actions. Visit your farm's detail page to configure which NFTs can be staked.",
  },
  {
    question: "Is there a limit to how many NFTs can be staked?",
    answer: "There is no hard limit on the number of NFTs that can be staked in a V2 farm. However, you should ensure you have enough reward tokens deposited to cover payouts for all stakers.",
  },
  {
    question: "Can I have multiple reward tokens?",
    answer: "Yes! V2 farms support up to 3 different reward tokens. You can configure different tokens when creating the farm, allowing you to reward stakers with multiple tokens simultaneously.",
  },
  {
    question: "How often are rewards paid out?",
    answer: "Rewards accumulate continuously based on the hourly rate you set. The 'Hours Between Payouts' setting determines the minimum interval between claim transactions. Enter a number between 1 and 720 hours.",
  },
  {
    question: "Are staked NFTs safe?",
    answer: "V2 farms are non-custodial - NFTs remain in your wallet while staked. The smart contract only tracks which NFTs are registered for rewards. WaxDAO has been audited and running since 2021.",
  },
  {
    question: "What are the IPFS hash fields for?",
    answer: "Avatar Image is a small profile picture (e.g. 300x300px). Cover Image is a large background banner. Both should be IPFS hashes only (e.g. QmXxx...), not full URLs. Supported formats: JPEG and PNG.",
  },
  {
    question: "Why does Anchor show a 'Dangerous Transaction' warning?",
    answer: "This transaction includes inline actions from the cheesefeefee smart contract — it sends WAXDAO tokens to your wallet and burns fees automatically. These are standard, safe operations and the contract is open source.\n\nTo proceed in Anchor Wallet:\n1. Tap the gear/settings icon\n2. Toggle 'Allow Dangerous Transactions' ON\n3. Sign the transaction\n4. Optionally toggle it back OFF afterward\n\nSome versions of Anchor also show an 'Allow for this transaction only' checkbox you can use instead.",
  },
];

const CONFIRMATION_PHRASE = "I understand how the new farms work";

export function CreateFarm() {
  const { accountName, isConnected, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const cheesePricing = useCheeseFeePricing();
  const waxdaoPricing = useWaxdaoFeePricing();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [farmName, setFarmName] = useState("");
  const [farmType, setFarmType] = useState<FarmType>("templates");
  const [hoursBetween, setHoursBetween] = useState("24");

  const [rewardTokens, setRewardTokens] = useState<RewardToken[]>([
    { contract: "cheeseburger", symbol: "CHEESE", precision: 4 },
  ]);

  const [avatar, setAvatar] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [description, setDescription] = useState("");
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [socials, setSocials] = useState({
    twitter: "", discord: "", telegram: "", website: "", youtube: "", medium: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<"wax" | "cheese" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpAccordionValue, setHelpAccordionValue] = useState<string | undefined>(undefined);

  const validation = validateFarmName(farmName);

  const handleConfirm = () => {
    if (confirmText.toLowerCase().trim() === CONFIRMATION_PHRASE.toLowerCase()) {
      setConfirmed(true);
    }
  };

  const addRewardToken = () => {
    if (rewardTokens.length >= 3) return;
    setRewardTokens([...rewardTokens, { contract: "", symbol: "", precision: 4 }]);
  };

  const removeRewardToken = (index: number) => {
    setRewardTokens(rewardTokens.filter((_, i) => i !== index));
  };

  const updateRewardToken = (index: number, field: keyof RewardToken, value: string | number) => {
    setRewardTokens(rewardTokens.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const handleCreate = async () => {
    if (!accountName || !validation.valid) return;

    setLoading(true);
    try {
      const hours = parseInt(hoursBetween) || 24;
      const actions: any[] = [];

      if (paymentMethod === "cheese" && cheesePricing.isAvailable) {
        actions.push(buildCheesePaymentAction(accountName, cheesePricing.formattedForTx, "farm", farmName));
      } else {
        actions.push(buildAssertPointAction(accountName));
        actions.push(buildFarmCreationFeeWaxAction(accountName));
      }

      actions.push(buildCreateFarmAction(
        accountName,
        farmName,
        farmType,
        hours,
        rewardTokens.filter(t => t.contract && t.symbol),
        { avatar, cover_image: coverImage, description },
        {
          ...socials,
          atomichub: "",
          waxdao: "",
        }
      ));

      const result = await executeTransaction(actions, {
        successTitle: "Farm Created! 🌱",
        successDescription: `${farmName} has been created successfully`,
      });

      if (result.success) {
        setFarmName("");
        setDescription("");
      }
    } finally {
      setLoading(false);
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

  if (!confirmed) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="bg-card/60 border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Before You Create a Farm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Be aware that in order for you to add stakable assets to this farm, you must be authorized on the NFT collection(s).
            </p>

            <p className="text-sm text-muted-foreground">
              VERY IMPORTANT!!!!! You must confirm that you understand how these new farms work before you are allowed to create one.
            </p>
            <p className="text-sm text-muted-foreground">
              Watch the following video and then enter "{CONFIRMATION_PHRASE}" (without quotes) into the box below. Once you do that, the farm creation form will magically appear.
            </p>

            <div className="rounded-lg overflow-hidden aspect-video bg-black">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/PIV_ojHzkS8"
                title="How to create a CHEESEFarm"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="space-y-2">
              <Label>Type the following to continue:</Label>
              <p className="text-sm text-primary font-mono">"{CONFIRMATION_PHRASE}"</p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type the phrase above..."
              />
              <Button
                onClick={handleConfirm}
                disabled={confirmText.toLowerCase().trim() !== CONFIRMATION_PHRASE.toLowerCase()}
                className="w-full bg-primary text-primary-foreground"
              >
                I Understand, Let Me Create
              </Button>
            </div>
          </CardContent>
        </Card>
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
            <Dialog open={helpOpen} onOpenChange={(open) => {
              setHelpOpen(open);
              if (!open) setHelpAccordionValue(undefined);
            }}>
              <DialogTrigger asChild>
                <button className="text-xs text-primary hover:underline ml-2 font-normal">click me for help</button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Farm Creation Guide</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <Accordion type="single" collapsible value={helpAccordionValue} onValueChange={setHelpAccordionValue} className="w-full">
                    {FAQ_ITEMS.map((item, index) => (
                      <AccordionItem key={index} value={`faq-${index}`}>
                        <AccordionTrigger>{item.question}</AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground whitespace-pre-line">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Farm Name */}
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

          {/* Farm Type */}
          <div>
            <Label>Farm Type</Label>
            <Select value={farmType} onValueChange={(v) => setFarmType(v as FarmType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FARM_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reward Tokens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Reward Tokens (up to 3)</Label>
              {rewardTokens.length < 3 && (
                <Button variant="ghost" size="sm" onClick={addRewardToken}>
                  <Plus className="h-4 w-4 mr-1" /> Add Token
                </Button>
              )}
            </div>
            {rewardTokens.map((token, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Contract</Label>
                  <Input
                    value={token.contract}
                    onChange={(e) => updateRewardToken(i, "contract", e.target.value)}
                    placeholder="cheeseburger"
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Symbol</Label>
                  <Input
                    value={token.symbol}
                    onChange={(e) => updateRewardToken(i, "symbol", e.target.value.toUpperCase())}
                    placeholder="CHEESE"
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs">Precision</Label>
                  <Input
                    type="number"
                    value={token.precision}
                    onChange={(e) => updateRewardToken(i, "precision", parseInt(e.target.value) || 0)}
                    min={0}
                    max={8}
                  />
                </div>
                {rewardTokens.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeRewardToken(i)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Hours between payouts */}
          <div>
            <Label>Hours Between Payouts (1-720)</Label>
            <Input
              type="number"
              value={hoursBetween}
              onChange={(e) => setHoursBetween(e.target.value)}
              min={1}
              max={720}
              placeholder="24"
            />
          </div>

          {/* Avatar / Cover */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Avatar (IPFS hash)</Label>
              <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="Qm..." />
            </div>
            <div>
              <Label>Cover Image (IPFS hash)</Label>
              <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="Qm..." />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your farm..."
              rows={3}
            />
          </div>

          {/* Social Links */}
          <Collapsible open={socialsOpen} onOpenChange={setSocialsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                Social Links
                <ChevronDown className={`h-4 w-4 transition-transform ${socialsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {(Object.keys(socials) as Array<keyof typeof socials>).map(key => (
                <div key={key}>
                  <Label className="capitalize text-xs">{key}</Label>
                  <Input
                    value={socials[key]}
                    onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
                    placeholder={`https://${key}.com/...`}
                  />
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Payment */}
          <FeePaymentSelector
            selectedMethod={paymentMethod}
            onMethodChange={setPaymentMethod}
            onCheeseAmountChange={() => {}}
          />

          {/* Submit */}
          <Button
            onClick={handleCreate}
            disabled={loading || !validation.valid || rewardTokens.filter(t => t.contract && t.symbol).length === 0}
            className="w-full bg-primary text-primary-foreground"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating Farm...</>
            ) : (
              `Create Farm (${paymentMethod === "cheese" && cheesePricing.isAvailable ? cheesePricing.displayAmount : `${WAX_FEE_AMOUNT} WAX`})`
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
