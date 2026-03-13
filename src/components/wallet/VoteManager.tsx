import { useState, useEffect, useCallback } from 'react';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWax } from '@/context/WaxContext';
import { Loader2, Check, X, Users, Vote, Search } from 'lucide-react';
import { toast } from 'sonner';
import { fetchTable } from '@/lib/wax';

interface Producer { owner: string; total_votes: string; producer_key: string; is_active: number; url: string; unpaid_blocks: number; last_claim_time: string; location: number; }
interface ProxyVoter { owner: string; proxy: string; producers: string[]; staked: number; last_vote_weight: string; proxied_vote_weight: string; is_proxy: number; }
interface VoterInfo { owner: string; proxy: string; producers: string[]; staked: number; last_vote_weight: string; is_proxy: number; }
interface VoteManagerProps { onTransactionComplete: () => void; onTransactionSuccess: (title: string, description: string, txId: string | null) => void; }

function formatVotes(votes: string): string {
  const num = parseFloat(votes);
  if (isNaN(num)) return '0';
  const voteWeight = num / Math.pow(2, 52);
  if (voteWeight >= 1e9) return (voteWeight / 1e9).toFixed(2) + 'B';
  if (voteWeight >= 1e6) return (voteWeight / 1e6).toFixed(2) + 'M';
  if (voteWeight >= 1e3) return (voteWeight / 1e3).toFixed(2) + 'K';
  return voteWeight.toFixed(0);
}

function formatVotePercentage(votes: string, totalVotes: number): string {
  const num = parseFloat(votes);
  if (isNaN(num) || totalVotes === 0) return '0%';
  return ((num / totalVotes) * 100).toFixed(2) + '%';
}

const locationToCountry: Record<number, string> = {
  36: 'Australia', 76: 'Brazil', 124: 'Canada', 156: 'China', 276: 'Germany', 344: 'Hong Kong', 392: 'Japan',
  410: 'South Korea', 528: 'Netherlands', 702: 'Singapore', 826: 'United Kingdom', 840: 'United States',
  250: 'France', 380: 'Italy', 356: 'India', 360: 'Indonesia', 484: 'Mexico', 764: 'Thailand', 804: 'Ukraine',
};

function getLocationName(location: number): string { return locationToCountry[location] || '-'; }

export function VoteManager({ onTransactionComplete, onTransactionSuccess }: VoteManagerProps) {
  const { accountName, session } = useWax();
  const [activeTab, setActiveTab] = useState<'validators' | 'proxies'>('validators');
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [proxies, setProxies] = useState<ProxyVoter[]>([]);
  const [selectedProducers, setSelectedProducers] = useState<string[]>([]);
  const [selectedProxy, setSelectedProxy] = useState('');
  const [voterInfo, setVoterInfo] = useState<VoterInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [proxySearch, setProxySearch] = useState('');
  const [voteStrength, setVoteStrength] = useState(0);
  const [totalVoteWeight, setTotalVoteWeight] = useState(0);

  const fetchAllProducers = useCallback(async (): Promise<Producer[]> => {
    const allProducers: Producer[] = [];
    let lowerBound = '';
    let hasMore = true;
    while (hasMore) {
      const rows = await fetchTable<Producer>('eosio', 'eosio', 'producers', { lower_bound: lowerBound, limit: 500 });
      if (rows.length === 0) break;
      // Skip duplicate from previous page
      const startIdx = lowerBound && rows.length > 0 && rows[0].owner === lowerBound ? 1 : 0;
      allProducers.push(...rows.slice(startIdx));
      if (rows.length < 500) { hasMore = false; } else { lowerBound = rows[rows.length - 1].owner; }
    }
    return allProducers;
  }, []);

  const fetchAllProxies = useCallback(async (): Promise<ProxyVoter[]> => {
    const allProxies: ProxyVoter[] = [];
    let lowerBound = '';
    let hasMore = true;
    while (hasMore) {
      const rows = await fetchTable<ProxyVoter>('eosio', 'eosio', 'voters', { lower_bound: lowerBound, limit: 500 });
      if (rows.length === 0) break;
      const startIdx = lowerBound && rows.length > 0 && rows[0].owner === lowerBound ? 1 : 0;
      for (let i = startIdx; i < rows.length; i++) {
        if (rows[i].is_proxy === 1) allProxies.push(rows[i]);
      }
      if (rows.length < 500) { hasMore = false; } else { lowerBound = rows[rows.length - 1].owner; }
    }
    return allProxies;
  }, []);

  const fetchData = useCallback(async () => {
    if (!accountName) return;
    setIsLoading(true);
    try {
      const [allProducers, allProxies] = await Promise.all([fetchAllProducers(), fetchAllProxies()]);

      const sortedProducers = allProducers.filter(p => p.is_active === 1).sort((a, b) => parseFloat(b.total_votes) - parseFloat(a.total_votes));
      setProducers(sortedProducers);
      setTotalVoteWeight(sortedProducers.reduce((sum, p) => sum + parseFloat(p.total_votes), 0));

      allProxies.sort((a, b) => parseFloat(b.proxied_vote_weight || '0') - parseFloat(a.proxied_vote_weight || '0'));
      setProxies(allProxies);

      const voterData = await fetchTable<VoterInfo>('eosio', 'eosio', 'voters', { lower_bound: accountName, upper_bound: accountName, limit: 1 });
      if (voterData.length > 0) {
        setVoterInfo(voterData[0]);
        setSelectedProducers(voterData[0].producers || []);
        setSelectedProxy(voterData[0].proxy || '');
        if (voterData[0].staked) setVoteStrength(voterData[0].staked / 10000);
      }
    } catch (error) { console.error('Failed to fetch vote data:', error); toast.error('Failed to load voting data'); }
    finally { setIsLoading(false); }
  }, [accountName, fetchAllProducers, fetchAllProxies]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleProducerToggle = (producer: string) => {
    setSelectedProducers(prev => {
      if (prev.includes(producer)) return prev.filter(p => p !== producer);
      if (prev.length >= 30) { toast.error('Maximum 30 validators'); return prev; }
      return [...prev, producer].sort();
    });
    setSelectedProxy('');
  };

  const handleProxySelect = (proxy: string) => { setSelectedProxy(proxy); setSelectedProducers([]); };

  const handleVote = async () => {
    if (!session || !accountName) return;
    setIsVoting(true);
    try {
      const actions = [{ account: 'eosio', name: 'voteproducer', authorization: [session.permissionLevel],
        data: { voter: accountName, proxy: selectedProxy || '', producers: selectedProxy ? [] : selectedProducers.sort() } }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      if (selectedProxy) onTransactionSuccess('Vote Submitted!', `Delegated to proxy: ${selectedProxy}`, txId);
      else onTransactionSuccess('Vote Submitted!', `Voted for ${selectedProducers.length} validator(s)`, txId);
      onTransactionComplete(); fetchData();
    } catch (error: any) { toast.error(error?.message || 'Vote failed'); }
    finally { setIsVoting(false); closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 300); }
  };

  const filteredProducers = producers.filter(p => p.owner.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredProxies = proxies.filter(p => p.owner.toLowerCase().includes(proxySearch.toLowerCase()));
  const canVote = (selectedProducers.length > 0 || selectedProxy) && !isVoting;

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin mr-2" /><span>Loading vote data...</span></div>;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'validators' | 'proxies')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="validators" className="flex items-center gap-2"><Vote className="h-4 w-4" />Validators</TabsTrigger>
          <TabsTrigger value="proxies" className="flex items-center gap-2"><Users className="h-4 w-4" />Proxies</TabsTrigger>
        </TabsList>
        <TabsContent value="validators" className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Selected ({selectedProducers.length}/30):</span>
              <span className="text-muted-foreground">{selectedProducers.length > 0 ? selectedProducers.slice(0, 3).join(', ') + (selectedProducers.length > 3 ? '...' : '') : 'None'}</span>
            </div>
            <div className="flex justify-between text-sm"><span className="font-medium">Vote Strength:</span><span>{voteStrength.toLocaleString()} WAX</span></div>
            <Progress value={selectedProducers.length / 30 * 100} className="h-2" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search validators..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <ScrollArea className="h-[200px] border rounded-md">
            <div className="divide-y divide-border">
              {filteredProducers.map((producer, index) => {
                const isSelected = selectedProducers.includes(producer.owner);
                return (
                  <label key={producer.owner} className={`flex items-center gap-2 p-2 cursor-pointer text-xs select-none transition-colors ${isSelected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted/50'}`}>
                    <Checkbox checked={isSelected} onCheckedChange={() => handleProducerToggle(producer.owner)} className="h-4 w-4 pointer-events-none" />
                    <span className="text-muted-foreground w-5 text-center">{index + 1}</span>
                    <span className="font-medium flex-1 text-primary truncate">{producer.owner}</span>
                    <span className="text-muted-foreground w-20 truncate text-center">{getLocationName(producer.location)}</span>
                    <span className="text-muted-foreground w-12 text-right">{formatVotePercentage(producer.total_votes, totalVoteWeight)}</span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="proxies" className="space-y-4">
          {voterInfo?.proxy && <div className="p-3 bg-muted/50 rounded-lg text-sm"><span className="text-muted-foreground">Current Proxy: </span><span className="font-medium text-primary">{voterInfo.proxy}</span></div>}
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search proxies..." value={proxySearch} onChange={(e) => setProxySearch(e.target.value)} className="pl-9" /></div>
          <div className="space-y-2">
            <Label htmlFor="proxyAccount">Or enter proxy account:</Label>
            <div className="flex gap-2">
              <Input id="proxyAccount" placeholder="Enter proxy account name" value={selectedProxy} onChange={(e) => { setSelectedProxy(e.target.value.toLowerCase()); setSelectedProducers([]); }} />
              {selectedProxy && <Button variant="ghost" size="icon" onClick={() => setSelectedProxy('')}><X className="h-4 w-4" /></Button>}
            </div>
          </div>
          <ScrollArea className="h-[180px] border rounded-md">
            <div className="divide-y divide-border">
              {filteredProxies.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">No registered proxies found.</div>
              ) : filteredProxies.map((proxy, index) => (
                <label key={proxy.owner} className={`flex items-center gap-1 p-2 cursor-pointer text-xs select-none transition-colors ${selectedProxy === proxy.owner ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted/50'}`} onClick={() => handleProxySelect(proxy.owner)}>
                  <Checkbox checked={selectedProxy === proxy.owner} className="h-3 w-3 pointer-events-none flex-shrink-0" />
                  <span className="text-muted-foreground w-4 text-center flex-shrink-0">{index + 1}</span>
                  <span className="font-medium flex-1 text-primary truncate min-w-0">{proxy.owner}</span>
                  <span className="text-muted-foreground text-right flex-shrink-0">{formatVotes(proxy.proxied_vote_weight || '0')}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <Button onClick={handleVote} disabled={!canVote} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">
        {isVoting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting Vote...</> : <><Vote className="mr-2 h-4 w-4" />{activeTab === 'proxies' ? 'Set Proxy' : `Vote for ${selectedProducers.length} Validator(s)`}</>}
      </Button>
    </div>
  );
}
