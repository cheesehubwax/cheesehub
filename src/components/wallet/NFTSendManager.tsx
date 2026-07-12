import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useWax } from '@/context/WaxContext';
import { useUserNFTs } from '@/hooks/useUserNFTs';
import { useDebounce } from '@/hooks/useDebounce';
import { Check, X, Loader2, Search, Image, Send, RefreshCw, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import { useSquareGridRowHeight } from '@/hooks/useSquareGridRowHeight';
import { NFTGridCard } from '@/components/shared/NFTGridCard';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

interface NFTSendManagerProps {
  onTransactionSuccess: (title: string, description: string, txId: string | null) => void;
}

type SortOption = 'collection' | 'name' | 'newest' | 'oldest';

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

export function NFTSendManager({ onTransactionSuccess }: NFTSendManagerProps) {
  const { accountName, transferNFTs, burnNFTs } = useWax();
  const { nfts, isLoading, refetch } = useUserNFTs(accountName || undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [schemaFilter, setSchemaFilter] = useState<string>('all');
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [confirmBurn, setConfirmBurn] = useState(false);

  const isValidRecipient = recipient.length > 0 && isValidWaxAccount(recipient);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const parentRef = useRef<HTMLDivElement>(null);
  const canSend = isValidRecipient && selectedNFTs.size > 0 && !isSending;

  // Get unique collections
  const collections = useMemo(() => {
    const colMap = new Map<string, number>();
    nfts.forEach(nft => colMap.set(nft.collection, (colMap.get(nft.collection) || 0) + 1));
    return Array.from(colMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [nfts]);

  // Get unique schemas for the selected collection
  const schemas = useMemo(() => {
    if (collectionFilter === 'all') return [];
    const schemaMap = new Map<string, number>();
    nfts.filter(nft => nft.collection === collectionFilter).forEach(nft => {
      if (nft.schema) schemaMap.set(nft.schema, (schemaMap.get(nft.schema) || 0) + 1);
    });
    return Array.from(schemaMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [nfts, collectionFilter]);

  const handleCollectionChange = useCallback((value: string) => {
    setCollectionFilter(value);
    setSchemaFilter('all');
  }, []);

  const filteredNFTs = useMemo(() => {
    let result = [...nfts];
    if (collectionFilter !== 'all') result = result.filter(nft => nft.collection === collectionFilter);
    if (schemaFilter !== 'all') result = result.filter(nft => nft.schema === schemaFilter);
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(nft => nft.name.toLowerCase().includes(query) || nft.collection.toLowerCase().includes(query));
    }
    switch (sortBy) {
      case 'collection': result.sort((a, b) => a.collection.localeCompare(b.collection)); break;
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'newest':
        result.sort((a, b) => {
          const transferCompare = (b.transferred_at_time || '').localeCompare(a.transferred_at_time || '', undefined, { numeric: true });
          return transferCompare || b.asset_id.localeCompare(a.asset_id, undefined, { numeric: true });
        });
        break;
      case 'oldest':
        result.sort((a, b) => {
          const transferCompare = (a.transferred_at_time || '').localeCompare(b.transferred_at_time || '', undefined, { numeric: true });
          return transferCompare || a.asset_id.localeCompare(b.asset_id, undefined, { numeric: true });
        });
        break;
    }
    return result;
  }, [nfts, collectionFilter, schemaFilter, debouncedSearch, sortBy]);

  const COLUMNS = 6;
  const ROW_HEIGHT = 120;
  const rowHeight = useSquareGridRowHeight(parentRef, { columns: COLUMNS, fallback: ROW_HEIGHT });
  const rowCount = Math.ceil(filteredNFTs.length / COLUMNS);
  const virtualizer = useVirtualizer({ count: rowCount, getScrollElement: () => parentRef.current, estimateSize: () => rowHeight, overscan: 3 });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  const toggleNFTSelection = useCallback((assetId: string) => {
    setSelectedNFTs(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else if (next.size < 50) next.add(assetId);
      return next;
    });
  }, []);

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      const assetIds = Array.from(selectedNFTs);
      const txId = await transferNFTs(recipient, assetIds, memo);
      if (txId) {
        onTransactionSuccess('NFTs Sent!', `Sent ${assetIds.length} NFT(s) to ${recipient}`, txId);
        setRecipient(''); setMemo(''); setSelectedNFTs(new Set());
      }
    } catch (error) {
      closeWharfkitModals();
      const msg = error instanceof Error ? error.message : 'Transfer failed';
      if (!msg.toLowerCase().includes('cancel')) toast.error('NFT transfer failed', { description: msg });
    } finally { setIsSending(false); setTimeout(() => closeWharfkitModals(), 100); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nft-recipient">Recipient</Label>
        <div className="relative">
          <Input id="nft-recipient" placeholder="Enter WAX account" value={recipient} onChange={(e) => setRecipient(e.target.value.toLowerCase())} className="pr-10" />
          {recipient.length > 0 && <div className="absolute right-3 top-1/2 -translate-y-1/2">{isValidRecipient ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}</div>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Select NFTs to Send</Label>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[120px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
          <Select value={collectionFilter} onValueChange={handleCollectionChange}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Collection" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({nfts.length})</SelectItem>
              {collections.map(col => <SelectItem key={col.name} value={col.name}>{col.name} ({col.count})</SelectItem>)}
            </SelectContent>
          </Select>
          {collectionFilter !== 'all' && schemas.length > 0 && (
            <Select value={schemaFilter} onValueChange={setSchemaFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Schema" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schemas</SelectItem>
                {schemas.map(s => <SelectItem key={s.name} value={s.name}>{s.name} ({s.count})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem><SelectItem value="collection">Collection</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              setIsRefreshing(true);
              await refetch();
              setIsRefreshing(false);
            }}
            title="Refresh NFTs"
            className="h-9 w-9"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{selectedNFTs.size} selected {selectedNFTs.size >= 50 && '(max 50)'}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedNFTs(new Set(filteredNFTs.slice(0, 50).map(n => n.asset_id)))} disabled={filteredNFTs.length === 0}>Select All</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedNFTs(new Set())} disabled={selectedNFTs.size === 0}>Clear</Button>
        </div>
      </div>
      <div ref={parentRef} className="h-[560px] overflow-auto rounded-md border border-border">
        {isLoading && nfts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="text-muted-foreground text-sm">Loading NFTs...</span></div>
        ) : filteredNFTs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><Image className="h-8 w-8 mb-2" /><p>{nfts.length === 0 ? 'No NFTs' : 'No match'}</p></div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const startIndex = virtualRow.index * COLUMNS;
              const rowNFTs = filteredNFTs.slice(startIndex, startIndex + COLUMNS);
              return (
                <div key={virtualRow.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }} className="grid grid-cols-6 gap-2 p-1">
                  {rowNFTs.map(nft => (
                    <NFTGridCard
                      key={nft.asset_id}
                      nft={nft}
                      isSelected={selectedNFTs.has(nft.asset_id)}
                      onToggle={() => toggleNFTSelection(nft.asset_id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="space-y-2"><Label htmlFor="nft-memo">Memo (optional)</Label><Input id="nft-memo" placeholder="Enter memo" value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button onClick={handleSend} disabled={!canSend} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
          {isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send {selectedNFTs.size > 0 ? `${selectedNFTs.size} NFT(s)` : 'NFTs'}</>}
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmBurn(true)}
          disabled={selectedNFTs.size === 0 || isSending || isBurning}
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          {isBurning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Burning...</> : <><Flame className="mr-2 h-4 w-4" />Burn {selectedNFTs.size > 0 ? `(${selectedNFTs.size})` : ''}</>}
        </Button>
      </div>

      <AlertDialog open={confirmBurn} onOpenChange={setConfirmBurn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><OpenMojiIcon emoji="🔥" size={14} /> Burn {selectedNFTs.size} NFT{selectedNFTs.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is <strong>permanent and irreversible</strong>. The selected NFT{selectedNFTs.size !== 1 ? 's' : ''} will be destroyed forever and cannot be recovered. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                setIsBurning(true);
                setConfirmBurn(false);
                try {
                  const assetIds = Array.from(selectedNFTs);
                  const txId = await burnNFTs(assetIds);
                  if (txId) {
                    onTransactionSuccess('NFTs Burned! ', `Burned ${assetIds.length} NFT(s)`, txId);
                    setSelectedNFTs(new Set());
                  }
                } catch (error) {
                  closeWharfkitModals();
                  const msg = error instanceof Error ? error.message : 'Burn failed';
                  if (!msg.toLowerCase().includes('cancel')) toast.error('NFT burn failed', { description: msg });
                } finally {
                  setIsBurning(false);
                  setTimeout(() => closeWharfkitModals(), 100);
                }
              }}
            >
              <Flame className="mr-2 h-4 w-4" />
              Yes, Burn Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
