import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { DaoInfo, buildAnnounceDepoAction, buildProposalCostAction, VOTING_TYPE_LABELS, PROPOSAL_VOTING_TYPES } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";

interface CreateProposalProps {
  daoName: string;
  dao: DaoInfo;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProposal({ daoName, dao, onClose, onCreated }: CreateProposalProps) {
  const { accountName, session } = useWax();
  const { transact, loading } = useWaxTransaction();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [votingType, setVotingType] = useState("1");
  const [choices, setChoices] = useState(["Yes", "No", "Abstain"]);
  const [hoursToVote, setHoursToVote] = useState(dao.hours_per_proposal || 72);

  const handleSubmit = async () => {
    if (!session || !accountName) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Missing fields", description: "Title and description are required", variant: "destructive" });
      return;
    }

    const actions = [];

    // Announce deposit if there's a proposal cost
    if (dao.proposal_cost && dao.proposal_cost !== "0") {
      actions.push(buildAnnounceDepoAction(accountName));
      actions.push(buildProposalCostAction(accountName, dao.proposal_cost));
    }

    // Create proposal action
    actions.push({
      account: "dao.waxdao",
      name: "createprop",
      authorization: [{ actor: accountName, permission: "active" }],
      data: {
        author: accountName,
        dao: daoName,
        title,
        description,
        proposal_type: parseInt(votingType),
        choices: choices.map((c, i) => ({ choice: i, description: c, total_votes: 0 })),
        hours: hoursToVote,
        token_receivers: [],
        nft_receivers: [],
      },
    });

    const result = await transact(actions);
    if (result.success) {
      toast({ title: "Proposal Created! 🧀", description: `"${title}" has been submitted` });
      onCreated();
    }
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Proposal title" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your proposal..." rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Voting Type</Label>
            <Select value={votingType} onValueChange={setVotingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VOTING_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Voting Duration (hours)</Label>
            <Input type="number" value={hoursToVote} onChange={(e) => setHoursToVote(parseInt(e.target.value) || 72)} min={1} />
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="w-full bg-primary text-primary-foreground">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "Submit Proposal"}
        </Button>
      </CardContent>
    </Card>
  );
}
