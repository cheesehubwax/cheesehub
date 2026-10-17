import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Eraser, ImagePlus, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NFTGridCard } from '@/components/shared/NFTGridCard';
import { useUserNFTs, UserNFT } from '@/hooks/useUserNFTs';
import { useSquareGridRowHeight } from '@/hooks/useSquareGridRowHeight';
import { accountAvatar, CryptAvatar, quantizeAvatar } from '@/lib/cryptAvatar';
import { extractIpfsHash, ipfsImageCandidates } from '@/lib/ipfsGateways';
import { PixelAvatar } from './PixelAvatar';
import { cn } from '@/lib/utils';

async function pixelsFromBlob(blob: Blob): Promise<CryptAvatar> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 8; canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image editing is unavailable in this browser.');
    const scale = Math.min(8 / bitmap.width, 8 / bitmap.height);
    const width = bitmap.width * scale, height = bitmap.height * scale;
    ctx.drawImage(bitmap, (8 - width) / 2, (8 - height) / 2, width, height);
    const styles = getComputedStyle(document.documentElement);
    const palette = Array.from({ length: 16 }, (_, i) => {
      if (!i) return [0, 0, 0];
      const hex = styles.getPropertyValue(`--avatar-${i}`).trim().slice(1);
      return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    });
    return quantizeAvatar(ctx.getImageData(0, 0, 8, 8).data, palette);
  } finally { bitmap.close(); }
}

async function nftPixels(image: string): Promise<CryptAvatar> {
  const hash = extractIpfsHash(image);
  const urls = hash ? ipfsImageCandidates(hash) : [image];
  const controllers = urls.map(() => new AbortController());
  const timers = controllers.map(ctl => setTimeout(() => ctl.abort(), 10000));
  try {
    const attempts = urls.map(async (url, i) => {
      if (!url.startsWith('/') && !url.startsWith('https://')) throw new Error('Unsupported image URL');
      const response = await fetch(url, { signal: controllers[i].signal });
      if (!response.ok) throw new Error('Image unavailable');
      const blob = await response.blob();
      if (blob.size > 10 * 1024 * 1024) throw new Error('Image too large');
      return pixelsFromBlob(blob);
    });
    return await new Promise<CryptAvatar>((resolve, reject) => {
      let remaining = attempts.length;
      attempts.forEach(attempt => attempt.then(resolve, () => { if (--remaining === 0) reject(new Error('No image source answered')); }));
    });
  } catch { throw new Error('Could not import this NFT image. Try another NFT or upload its image.'); }
  finally { timers.forEach(clearTimeout); controllers.forEach(ctl => ctl.abort()); }
}

function WalletAvatarPicker({ account, busy, onPick }: { account: string; busy: boolean; onPick: (nft: UserNFT) => void }) {
  const { nfts, isLoading, error, refetch, collections } = useUserNFTs(account);
  const [search, setSearch] = useState('');
  const [collection, setCollection] = useState('');
  const [schema, setSchema] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const schemas = useMemo(() => [...new Set(nfts.filter(n => !collection || n.collection === collection).map(n => n.schema))].sort(), [nfts, collection]);
  const filtered = useMemo(() => nfts.filter(n => (!collection || n.collection === collection) && (!schema || n.schema === schema)
    && `${n.name} ${n.asset_id} ${n.schema}`.toLowerCase().includes(search.toLowerCase())), [nfts, collection, schema, search]);
  const [columns, setColumns] = useState(() => window.matchMedia('(min-width: 640px)').matches ? 6 : 3);
  // Grid width follows the dialog, not the page; the height hook observes that width.
  const rowHeight = useSquareGridRowHeight(scrollRef, { columns });
  const virtualizer = useVirtualizer({ count: Math.ceil(filtered.length / columns), getScrollElement: () => scrollRef.current, estimateSize: () => rowHeight, overscan: 2 });
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <Input aria-label="Search NFTs" placeholder="Name, asset ID or schema" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-32" />
      <select aria-label="NFT collection" className="h-10 max-w-full rounded-md border border-input bg-background px-2 text-sm" value={collection}
        onChange={e => { setCollection(e.target.value); setSchema(''); }}>
        <option value="">All collections</option>{collections.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
      <select aria-label="NFT schema" className="h-10 max-w-full rounded-md border border-input bg-background px-2 text-sm" value={schema} onChange={e => setSchema(e.target.value)}>
        <option value="">All schemas</option>{schemas.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
    {isLoading && <p className="text-xs text-muted-foreground">Loading wallet NFTs…</p>}
    {error && <div className="text-sm text-destructive">NFTs could not be loaded. <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button></div>}
    <div ref={element => { scrollRef.current = element; if (element) { const next = element.clientWidth >= 500 ? 6 : 3; if (next !== columns) setColumns(next); } }} className="h-[560px] max-h-[40dvh] overflow-y-auto">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(row => <div key={row.key} className={cn('absolute top-0 left-0 w-full grid gap-2 pb-2', columns === 6 ? 'grid-cols-6' : 'grid-cols-3')} style={{ transform: `translateY(${row.start}px)` }}>
          {filtered.slice(row.index * columns, (row.index + 1) * columns).map(nft => <NFTGridCard key={nft.asset_id} nft={nft} isSelected={false} disabled={busy || nft.image === '/placeholder.svg'} onToggle={() => onPick(nft)} />)}
        </div>)}
      </div>
      {!isLoading && !filtered.length && <p className="text-sm text-muted-foreground py-6 text-center">No NFTs found.</p>}
    </div>
  </div>;
}

export function AvatarEditor({ account, avatar, onSave, onClose }: { account: string; avatar?: CryptAvatar; onSave: (avatar: CryptAvatar) => void; onClose: () => void }) {
  const [pixels, setPixels] = useState(() => (avatar ?? accountAvatar(account)).pixels);
  const [color, setColor] = useState('3');
  const [tab, setTab] = useState('paint');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drawing = useRef(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const importImage = async (getPixels: () => Promise<CryptAvatar>) => {
    setBusy(true); setError('');
    try { const next = await getPixels(); setPixels(next.pixels); setTab('paint'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not read this image.'); }
    finally { setBusy(false); }
  };
  const paint = (index: number) => setPixels(current => current.slice(0, index) + color + current.slice(index + 1));
  const paintAt = (x: number, y: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return;
    paint(Math.floor((y - rect.top) / rect.height * 8) * 8 + Math.floor((x - rect.left) / rect.width * 8));
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>🎨 Your avatar</DialogTitle></DialogHeader>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full"><TabsTrigger value="paint" className="flex-1"><Pencil className="h-4 w-4 mr-2" />Paint</TabsTrigger><TabsTrigger value="nft" className="flex-1">🖼️ Wallet NFT</TabsTrigger></TabsList>
        <TabsContent value="paint" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => uploadRef.current?.click()}><ImagePlus className="h-4 w-4 mr-2" />Upload image</Button>
            <div className="flex gap-2"><PixelAvatar account={account} avatar={{ version: 1, pixels }} className="h-10 w-10" /><PixelAvatar account={account} avatar={{ version: 1, pixels }} className="h-6 w-6 self-center" /></div>
          </div>
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => {
            const file = e.target.files?.[0]; e.target.value = '';
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { setError('Choose an image smaller than 10 MB.'); return; }
            void importImage(() => pixelsFromBlob(file));
          }} />
          <div ref={gridRef} className="mx-auto grid grid-cols-8 w-64 max-w-full aspect-square touch-none border border-border bg-muted"
            onPointerDown={e => { if (busy || e.button !== 0) return; e.preventDefault(); drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); paintAt(e.clientX, e.clientY); }}
            onPointerMove={e => { if (drawing.current) paintAt(e.clientX, e.clientY); }} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }}>
            {Array.from(pixels, (pixel, i) => <Button key={i} variant="ghost" disabled={busy} aria-label={`Pixel ${i + 1}`} className="crypt-pixel h-full w-full rounded-none p-0 border border-border/40"
              style={{ backgroundColor: `var(--avatar-${parseInt(pixel, 16)})` }} onClick={e => { if (e.detail === 0) paint(i); }} />)}
          </div>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Avatar colors">
            {Array.from({ length: 16 }, (_, i) => <Button key={i} variant="outline" size="icon" aria-label={i ? `Color ${i}` : 'Eraser'} title={i ? `Color ${i}` : 'Eraser'} aria-pressed={color === i.toString(16)}
              onClick={() => setColor(i.toString(16))} className={cn('h-8 w-8 border-2', color === i.toString(16) && 'ring-2 ring-cheese ring-offset-2 ring-offset-background')}
              style={{ backgroundColor: `var(--avatar-${i})` }}>{!i && <Eraser className="h-4 w-4" />}</Button>)}
          </div>
          <div className="flex justify-center gap-2"><Button variant="ghost" size="sm" disabled={busy} onClick={() => setPixels(accountAvatar(account).pixels)}><RotateCcw className="h-4 w-4 mr-2" />Default</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => setPixels('0'.repeat(64))}><Trash2 className="h-4 w-4 mr-2" />Clear</Button></div>
        </TabsContent>
        <TabsContent value="nft"><WalletAvatarPicker account={account} busy={busy} onPick={nft => void importImage(() => nftPixels(nft.image))} /></TabsContent>
      </Tabs>
      {busy && <p className="text-sm text-muted-foreground" role="status">Importing image…</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={() => onSave({ version: 1, pixels })}><Save className="h-4 w-4 mr-2" />Save avatar</Button></div>
    </DialogContent>
  </Dialog>;
}