import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TokenLogo } from '@/components/TokenLogo';
import { toast } from '@/hooks/use-toast';
import type { FolioPortfolio } from '@/lib/folio/portfolios';
import type { HoldingRow } from '@/lib/folio/holdings';
import { fmt } from './format';

interface Props {
  portfolios: FolioPortfolio[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onSave: (items: FolioPortfolio[]) => Promise<void>;
  rows: HoldingRow[];
  disabled: boolean;
}

export function PortfolioControls({ portfolios, selected, onSelect, onSave, rows, disabled }: Props) {
  const [draft, setDraft] = useState<FolioPortfolio | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const current = portfolios.find((p) => p.id === selected);
  const open = (p?: FolioPortfolio) => {
    const now = Date.now();
    setDraft(p ? { ...p, tokenKeys: [...p.tokenKeys] } : { id: crypto.randomUUID(), name: '', tokenKeys: [], createdAt: now, updatedAt: now });
    setSearch('');
  };
  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    try {
      const item = { ...draft, name: draft.name.trim(), updatedAt: Date.now() };
      await onSave(current?.id === item.id || portfolios.some((p) => p.id === item.id)
        ? portfolios.map((p) => p.id === item.id ? item : p) : [...portfolios, item]);
      onSelect(item.id);
      setDraft(null);
    } catch (e) { toast({ title: 'Could not save portfolio', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!current || !confirm(`Delete “${current.name}”? Your tokens and history stay unchanged.`)) return;
    try { await onSave(portfolios.filter((p) => p.id !== current.id)); onSelect(null); }
    catch { toast({ title: 'Could not delete portfolio', variant: 'destructive' }); }
  };
  const available = new Map(rows.map((r) => [r.key, { key: r.key, symbol: r.symbol, contract: r.contract, balance: r.balance, precision: r.precision }]));
  for (const key of draft?.tokenKeys ?? []) if (!available.has(key)) {
    const [contract, symbol] = key.split(':');
    available.set(key, { key, contract, symbol, balance: 0, precision: 4 });
  }
  const options = [...available.values()].filter((r) => `${r.symbol} ${r.contract}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.symbol.localeCompare(b.symbol));
  return (
    <div className="w-full border-y border-border/50 py-3 space-y-3">
      <div role="tablist" aria-label="Portfolios" className="flex flex-wrap gap-2">
        <Button role="tab" aria-selected={!current} variant={!current ? 'default' : 'outline'} size="sm" onClick={() => onSelect(null)}>📂 All Holdings</Button>
        {portfolios.map((p) => <Button key={p.id} role="tab" aria-selected={current?.id === p.id} variant={current?.id === p.id ? 'default' : 'outline'} size="sm" className="h-auto min-h-9 max-w-full whitespace-normal break-words" onClick={() => onSelect(p.id)}>📂 {p.name}</Button>)}
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => open()}>＋ New portfolio</Button>
      </div>
      {current ? <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">{current.tokenKeys.length} tokens</span>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => open(current)}>✍️ Edit portfolio</Button>
        <Button size="icon" variant="ghost" disabled={disabled} aria-label="Delete portfolio" title="Delete portfolio" onClick={() => void remove()}>🗑️</Button>
      </div> : null}
      <Dialog open={!!draft} onOpenChange={(o) => !o && !saving && setDraft(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{portfolios.some((p) => p.id === draft?.id) ? 'Edit portfolio' : 'New portfolio'}</DialogTitle></DialogHeader>
          <label className="space-y-1 text-sm">Name<Input aria-label="Portfolio name" maxLength={80} value={draft?.name ?? ''} onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)} /></label>
          <Input aria-label="Search portfolio tokens" placeholder="Search tokens or contracts" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{draft?.tokenKeys.length ?? 0} selected</span>
            <Button size="sm" variant="ghost" onClick={() => setDraft((d) => d ? { ...d, tokenKeys: [...new Set([...d.tokenKeys, ...options.map((r) => r.key)])] } : d)}>Select shown</Button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {options.map((r) => <label key={r.key} className="flex items-center gap-3 py-2 cursor-pointer text-sm">
              <Checkbox aria-label={`Include ${r.symbol} (${r.contract})`} checked={draft?.tokenKeys.includes(r.key) ?? false} onCheckedChange={(v) => setDraft((d) => d ? { ...d, tokenKeys: v === true ? [...new Set([...d.tokenKeys, r.key])] : d.tokenKeys.filter((k) => k !== r.key) } : d)} />
              <TokenLogo contract={r.contract} symbol={r.symbol} size="sm" />
              <span className="min-w-0 flex-1 break-words">{r.symbol}<span className="block text-xs text-muted-foreground">{r.contract}</span></span>
              <span className="text-xs">{fmt(r.balance, r.precision)}</span>
            </label>)}
            {!options.length ? <p className="py-4 text-sm text-muted-foreground text-center">No matching tokens.</p> : null}
          </div>
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button><Button disabled={saving || !draft?.name.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Save portfolio'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PortfolioTokenPicker({ tokenKey, portfolios, onSave, disabled }: { tokenKey: string; portfolios: FolioPortfolio[]; onSave: Props['onSave']; disabled: boolean }) {
  return <Select disabled={disabled || !portfolios.length} value="" onValueChange={(id) => {
    const p = portfolios.find((p) => p.id === id);
    if (!p) return;
    const included = p.tokenKeys.includes(tokenKey);
    void onSave(portfolios.map((item) => item.id === id ? { ...item, updatedAt: Date.now(), tokenKeys: included ? item.tokenKeys.filter((k) => k !== tokenKey) : [...item.tokenKeys, tokenKey] } : item))
      .catch(() => toast({ title: 'Could not update portfolio', variant: 'destructive' }));
  }}>
    <SelectTrigger className="h-7 w-7 p-0 justify-center" aria-label="Add to or remove from portfolio" title="Add to or remove from portfolio">＋</SelectTrigger>
    <SelectContent>{portfolios.map((p) => <SelectItem key={p.id} value={p.id}>{p.tokenKeys.includes(tokenKey) ? '✓ Remove from' : '＋ Add to'} {p.name}</SelectItem>)}</SelectContent>
  </Select>;
}