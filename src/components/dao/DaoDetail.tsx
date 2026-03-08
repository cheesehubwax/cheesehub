import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Users, Vote, Plus, LogIn, LogOut } from "lucide-react";
import { fetchDaoDetails, fetchProposals, DaoInfo, Proposal, DAO_TYPES, PROPOSER_TYPES, getIpfsUrl } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { ProposalCard } from "./ProposalCard";
import { CreateProposal } from "./CreateProposal";

interface DaoDetailProps {
  daoName: string;
  onBack: () => void;
}

export function DaoDetail({ daoName, onBack }: DaoDetailProps) {
  const { isConnected, accountName, joinDao, leaveDao } = useWax();
  const [dao, setDao] = useState<DaoInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function loadDao() {
      setLoading(true);
      const [daoData, proposalData] = await Promise.all([
        fetchDaoDetails(daoName),
        fetchProposals(daoName),
      ]);
      setDao(daoData);
      setProposals(proposalData);
      setLoading(false);
    }
    loadDao();
  }, [daoName]);

  const handleJoin = async () => {
    setJoining(true);
    const result = await joinDao(daoName);
    if (result) setIsMember(true);
    setJoining(false);
  };

  const handleLeave = async () => {
    setJoining(true);
    const result = await leaveDao(daoName);
    if (result) setIsMember(false);
    setJoining(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dao) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">DAO not found</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const logoUrl = getIpfsUrl(dao.logo);
  const activeProposals = proposals.filter(p => p.status === "active");
  const pastProposals = proposals.filter(p => p.status !== "active");

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to DAOs
      </Button>

      {/* DAO Header */}
      <Card className="bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="h-20 w-20 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={dao.dao_name} className="h-full w-full object-cover" />
              ) : (
                <Users className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-foreground">{dao.dao_name}</h2>
              <p className="text-muted-foreground mt-1">Created by {dao.creator}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary">{DAO_TYPES[dao.dao_type] || "Unknown"}</Badge>
                <Badge variant="outline">{PROPOSER_TYPES[dao.proposer_type] || "Unknown"}</Badge>
                {dao.token_symbol && <Badge variant="outline">{dao.token_symbol}</Badge>}
              </div>
            </div>
            {isConnected && (
              <div className="flex gap-2">
                {isMember ? (
                  <Button variant="outline" onClick={handleLeave} disabled={joining}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {joining ? "Leaving..." : "Leave DAO"}
                  </Button>
                ) : (
                  <Button onClick={handleJoin} disabled={joining} className="bg-primary text-primary-foreground">
                    <LogIn className="h-4 w-4 mr-2" />
                    {joining ? "Joining..." : "Join DAO"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
            <div>
              <p className="text-sm text-muted-foreground">Proposals</p>
              <p className="text-lg font-semibold">{proposals.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-lg font-semibold text-primary">{activeProposals.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Threshold</p>
              <p className="text-lg font-semibold">{dao.threshold}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Proposal Cost</p>
              <p className="text-lg font-semibold">{dao.proposal_cost || "Free"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposals */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-primary" />
              Proposals
            </CardTitle>
            {isConnected && (
              <Button size="sm" onClick={() => setShowCreateProposal(!showCreateProposal)}>
                <Plus className="h-4 w-4 mr-2" /> New Proposal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showCreateProposal && (
            <div className="mb-6">
              <CreateProposal
                daoName={daoName}
                dao={dao}
                onClose={() => setShowCreateProposal(false)}
                onCreated={() => {
                  setShowCreateProposal(false);
                  fetchProposals(daoName).then(setProposals);
                }}
              />
            </div>
          )}

          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({activeProposals.length})</TabsTrigger>
              <TabsTrigger value="past">Past ({pastProposals.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="space-y-4 mt-4">
              {activeProposals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active proposals</p>
              ) : (
                activeProposals.map(p => (
                  <ProposalCard key={p.proposal_id} proposal={p} daoName={daoName} />
                ))
              )}
            </TabsContent>
            <TabsContent value="past" className="space-y-4 mt-4">
              {pastProposals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No past proposals</p>
              ) : (
                pastProposals.map(p => (
                  <ProposalCard key={p.proposal_id} proposal={p} daoName={daoName} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
