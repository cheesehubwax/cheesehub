import { useState, useEffect, useCallback, useRef } from 'react';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useWax } from '@/context/WaxContext';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountResources, formatBytes } from './WalletResources';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

const WAX_ENDPOINTS = ['https://wax.greymass.com', 'https://api.wax.alohaeos.com', 'https://wax.eosphere.io'];

interface RamManagerProps {
  resources: AccountResources | null;
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

interface PricePoint { time: number; price: number; }

export function RamManager({ resources, onTransactionComplete, onTransactionSuccess }: RamManagerProps) {
  const { session, accountName } = useWax();
  const [isTransacting, setIsTransacting] = useState(false);
  const [ramPricePerByte, setRamPricePerByte] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [buyReceiver, setBuyReceiver] = useState('');
  const [buyMode, setBuyMode] = useState<'wax' | 'bytes'>('wax');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellMode, setSellMode] = useState<'wax' | 'bytes'>('bytes');
  const [sellAmount, setSellAmount] = useState('');

  const fetchRamPrice = useCallback(async () => {
    try {
      const response = await fetchWithFallback(WAX_ENDPOINTS, '/v1/chain/get_table_rows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'eosio', scope: 'eosio', table: 'rammarket', json: true, limit: 1 }),
      });
      const data = await response.json();
      if (data.rows?.[0]) {
        const quoteBalance = parseFloat(data.rows[0].quote.balance.split(' ')[0]);
        const baseBalance = parseFloat(data.rows[0].base.balance.split(' ')[0]);
        const pricePerByte = quoteBalance / baseBalance;
        setRamPricePerByte(pricePerByte);
        setPriceHistory(prev => [...prev, { time: Date.now(), price: pricePerByte }].slice(-20));
      }
    } catch (error) { console.error('Failed to fetch RAM price:', error); }
  }, []);

  useEffect(() => { fetchRamPrice(); intervalRef.current = setInterval(fetchRamPrice, 30000); return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, [fetchRamPrice]);
  useEffect(() => { if (accountName) setBuyReceiver(accountName); }, [accountName]);

  const estimatedBytes = buyMode === 'wax' && ramPricePerByte ? Math.floor((parseFloat(buyAmount) || 0) / ramPricePerByte) : buyMode === 'bytes' ? parseInt(buyAmount) || 0 : 0;
  const estimatedWaxCost = buyMode === 'bytes' && ramPricePerByte && buyAmount ? ((parseInt(buyAmount) || 0) * ramPricePerByte).toFixed(8) : null;
  const sellBytes = sellMode === 'bytes' ? parseInt(sellAmount) || 0 : ramPricePerByte && sellAmount ? Math.floor((parseFloat(sellAmount) / ramPricePerByte) / 0.995) : 0;
  const estimatedWaxReturn = ramPricePerByte && sellBytes ? (sellBytes * ramPricePerByte * 0.995).toFixed(8) : null;
  const formatPrice = (price: number) => price.toFixed(8);

  const handleBuyRam = async () => {
    if (!session || !buyReceiver || !buyAmount) return;
    setIsTransacting(true);
    try {
      const actions = buyMode === 'wax'
        ? [{ account: 'eosio', name: 'buyram', authorization: [session.permissionLevel], data: { payer: accountName, receiver: buyReceiver, quant: `${parseFloat(buyAmount).toFixed(8)} WAX` } }]
        : [{ account: 'eosio', name: 'buyrambytes', authorization: [session.permissionLevel], data: { payer: accountName, receiver: buyReceiver, bytes: parseInt(buyAmount) } }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      const desc = buyMode === 'wax' ? `Purchased ~${formatBytes(estimatedBytes)} RAM for ${parseFloat(buyAmount).toFixed(8)} WAX` : `Purchased ${parseInt(buyAmount).toLocaleString()} bytes of RAM`;
      onTransactionSuccess?.('RAM Purchased!', `${desc} for ${buyReceiver}`, txId);
      setBuyAmount(''); onTransactionComplete?.();
    } catch (error: any) { toast.error(error?.message || 'Failed to buy RAM'); }
    finally { setIsTransacting(false); closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 300); }
  };

  const handleSellRam = async () => {
    if (!session || !sellAmount || sellBytes <= 0) return;
    setIsTransacting(true);
    try {
      const actions = [{ account: 'eosio', name: 'sellram', authorization: [session.permissionLevel], data: { account: accountName, bytes: sellBytes } }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('RAM Sold!', `Sold ${formatBytes(sellBytes)} of RAM`, txId);
      setSellAmount(''); onTransactionComplete?.();
    } catch (error: any) { toast.error(error?.message || 'Failed to sell RAM'); }
    finally { setIsTransacting(false); closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 300); }
  };

  const isValidReceiver = buyReceiver.length > 0 && /^[a-z1-5.]{1,12}$/.test(buyReceiver);
  const availableRam = resources ? resources.ram_quota - resources.ram_usage : 0;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">RAM Price</span>
          {ramPricePerByte && <span className="text-sm font-medium text-primary">{formatPrice(ramPricePerByte)} WAX/byte</span>}
        </div>
        {priceHistory.length >= 2 ? (
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs><linearGradient id="ramPriceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs">{formatPrice(payload[0].value as number)} WAX</div> : null} />
                <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#ramPriceGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="h-12 flex items-center justify-center"><span className="text-xs text-muted-foreground">Building price history...</span></div>}
        <p className="text-[10px] text-muted-foreground mt-1 text-center">Updates every 30s • Session data only</p>
      </div>
      <Tabs defaultValue="buy" className="w-full">
        <TabsList className="w-full"><TabsTrigger value="buy" className="flex-1">Buy RAM</TabsTrigger><TabsTrigger value="sell" className="flex-1">Sell RAM</TabsTrigger></TabsList>
        <TabsContent value="buy" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>RAM Receiver:</Label>
            <div className="relative">
              <Input placeholder="Enter WAX account" value={buyReceiver} onChange={(e) => setBuyReceiver(e.target.value.toLowerCase())} className="pr-10" />
              {buyReceiver.length > 0 && <div className="absolute right-3 top-1/2 -translate-y-1/2">{isValidReceiver ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}</div>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Buy in WAX or Bytes?</Label>
            <RadioGroup value={buyMode} onValueChange={(v) => { setBuyMode(v as 'wax' | 'bytes'); setBuyAmount(''); }} className="flex gap-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="wax" id="wax" /><Label htmlFor="wax" className="cursor-pointer">WAX</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="bytes" id="bytes" /><Label htmlFor="bytes" className="cursor-pointer">Bytes</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>{buyMode === 'wax' ? 'Amount of RAM to Buy in WAX' : 'Amount of Bytes to Buy'}</Label>
            <Input type="number" placeholder={buyMode === 'wax' ? 'Amount in WAX' : 'Bytes'} value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} min={0} step={buyMode === 'wax' ? 0.00000001 : 1} />
            {buyMode === 'wax' && buyAmount && <p className="text-xs text-muted-foreground">≈ {formatBytes(estimatedBytes)}</p>}
            {buyMode === 'bytes' && buyAmount && estimatedWaxCost && <p className="text-xs text-muted-foreground">≈ {estimatedWaxCost} WAX</p>}
          </div>
          <Button onClick={handleBuyRam} disabled={!isValidReceiver || !buyAmount || isTransacting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isTransacting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buying RAM...</> : 'Buy RAM'}
          </Button>
        </TabsContent>
        <TabsContent value="sell" className="space-y-4 mt-4">
          <div className="p-3 bg-muted/50 rounded-lg text-sm"><span className="text-muted-foreground">Available RAM: </span><span className="font-medium">{formatBytes(availableRam)}</span><span className="text-muted-foreground ml-1">({availableRam.toLocaleString()} bytes)</span></div>
          <div className="space-y-2">
            <Label>Sell in WAX or Bytes?</Label>
            <RadioGroup value={sellMode} onValueChange={(v) => { setSellMode(v as 'wax' | 'bytes'); setSellAmount(''); }} className="flex gap-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="wax" id="sell-wax" /><Label htmlFor="sell-wax" className="cursor-pointer">WAX</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="bytes" id="sell-bytes" /><Label htmlFor="sell-bytes" className="cursor-pointer">Bytes</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>{sellMode === 'wax' ? 'Amount of WAX to Receive' : 'Amount of Bytes to Sell'}</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder={sellMode === 'wax' ? 'WAX amount' : 'Bytes'} value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} min={0} step={sellMode === 'wax' ? 0.00000001 : 1} />
              <Button type="button" variant="outline" size="sm" onClick={() => setSellAmount(sellMode === 'bytes' ? availableRam.toString() : (ramPricePerByte ? (availableRam * ramPricePerByte * 0.995).toFixed(8) : '0'))} className="shrink-0">Max</Button>
            </div>
            {sellMode === 'bytes' && sellAmount && estimatedWaxReturn && <p className="text-xs text-muted-foreground">≈ {estimatedWaxReturn} WAX (after 0.5% fee)</p>}
            {sellMode === 'wax' && sellAmount && sellBytes > 0 && <p className="text-xs text-muted-foreground">≈ {formatBytes(sellBytes)} ({sellBytes.toLocaleString()} bytes)</p>}
          </div>
          <Button onClick={handleSellRam} disabled={!sellAmount || sellBytes <= 0 || isTransacting} className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {isTransacting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Selling RAM...</> : 'Sell RAM'}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
