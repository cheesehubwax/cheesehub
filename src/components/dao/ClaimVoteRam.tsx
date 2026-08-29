import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, HardDrive, CheckCircle } from "lucide-react";
import { fetchProposals, buildClaimVoteRamAction, Proposal } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";

interface ClaimVoteRamProps {
  daoName: string;
}

export function ClaimVoteRam({ daoName }: ClaimVoteRamProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimed, setClaimed] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchProposals(daoName).then(data => {
      const ended = data.filter(p => p.status !== "active");
      setProposals(ended);
      setLoading(false);
    });
  }, [daoName]);

  const handleClaim = async (proposalId: number) => {
    if (!session || !accountName) return;
    setClaiming(proposalId);

    const action = buildClaimVoteRamAction(accountName, daoName, proposalId);
    const result = await executeTransaction([action], {
      successTitle: "RAM Reclaimed! ",
      successDescription: `Vote RAM reclaimed from proposal #${proposalId}`,
    });

    if (result.success) {
      setClaimed(prev => new Set(prev).add(proposalId));
    }
    setClaiming(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-8">
        <HardDrive className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No ended proposals to reclaim RAM from</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Reclaim RAM from your votes on ended proposals. This frees up WAX resources on your account.
      </p>
      {proposals.map(p => (
        <Card key={p.proposal_id} className="bg-card/60 border-border/40">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">#{p.proposal_id}</Badge>
                <Badge variant="secondary" className="text-xs capitalize">{p.status}</Badge>
              </div>
            </div>
            {claimed.has(p.proposal_id) ? (
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClaim(p.proposal_id)}
                disabled={claiming !== null}
              >
                {claiming === p.proposal_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Claim RAM"
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
