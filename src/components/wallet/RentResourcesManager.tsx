import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWax } from '@/context/WaxContext';
import { usePowerupEstimate } from '@/hooks/usePowerupEstimate';
import { useCheesePriceData } from '@/hooks/useCheesePriceData';
import { Loader2, Check, X, Zap, Cpu, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import cheeseLogo from '@/assets/cheese-logo.png';

interface RentResourcesManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

export function RentResourcesManager({ onTransactionComplete, onTransactionSuccess }: RentResourcesManagerProps) {
  const { session, accountName, cheeseBalance } = useWax();
  const [isTransacting, setIsTransacting] = useState(false);
  const [receiver, setReceiver] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cheese' | 'wax'>('cheese');

  // CHEESE mode state
  const [cheeseCpu, setCheeseCpu] = useState('');
  const [cheeseNet, setCheeseNet] = useState('');

  // WAX mode state
  const [waxCpu, setWaxCpu] = useState('');
  const [waxNet, setWaxNet] = useState('');

  const cheeseCpuNum = parseFloat(cheeseCpu) || 0;
  const cheeseNetNum = parseFloat(cheeseNet) || 0;
  const totalCheese = cheeseCpuNum + cheeseNetNum;

  const waxCpuNum = parseFloat(waxCpu) || 0;
  const waxNetNum = parseFloat(waxNet) || 0;

  const isWaxMode = paymentMode === 'wax';
  const { data: cheesePriceData } = useCheesePriceData();
  const { estimate, isLoading: isEstimating } = usePowerupEstimate(
    isWaxMode ? waxCpuNum : cheeseCpuNum,
    isWaxMode ? waxNetNum : cheeseNetNum,
    isWaxMode,
    cheesePriceData ? { priceInWax: cheesePriceData.waxPrice, usdPrice: cheesePriceData.usdPrice } : undefined
  );

  const isValidReceiver = receiver.length > 0 && isValidWaxAccount(receiver);

  useEffect(() => {
    if (accountName) setReceiver(accountName);
  }, [accountName]);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes.toFixed(0)} bytes`;
  };

  const handleCheeseUp = async () => {
    if (!session || !isValidReceiver || totalCheese <= 0) return;
    if (totalCheese > cheeseBalance) {
      toast.error('Insufficient CHEESE balance');
      return;
    }

    setIsTransacting(true);
    try {
      const targetRecipient = receiver || accountName;
      let memo: string;
      if (cheeseCpuNum > 0 && cheeseNetNum > 0) {
        const cpuPercent = Math.round((cheeseCpuNum / totalCheese) * 100);
        const netPercent = 100 - cpuPercent;
        memo = `cpu:${cpuPercent},net:${netPercent}:${targetRecipient}`;
      } else if (cheeseNetNum > 0) {
        memo = `net:${targetRecipient}`;
      } else {
        memo = targetRecipient || '';
      }

      const actions = [{
        account: 'cheeseburger',
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: {
          from: String(session.actor),
          to: 'cheesepowerz',
          quantity: `${totalCheese.toFixed(4)} CHEESE`,
          memo,
        },
      }];

      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('CHEESEUp Successful! ', `Powered up ${targetRecipient} with ${totalCheese.toFixed(4)} CHEESE`, txId);
      setCheeseCpu('');
      setCheeseNet('');
      onTransactionComplete?.();
    } catch (error: any) {
      closeWharfkitModals();
      const msg = error?.message || 'CHEESEUp failed';
      if (!msg.toLowerCase().includes('cancel')) toast.error(msg);
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  const handleWaxPowerup = async () => {
    if (!session || !isValidReceiver || (waxCpuNum <= 0 && waxNetNum <= 0)) return;
    setIsTransacting(true);
    try {
      const actions = [{
        account: 'eosio',
        name: 'powerup',
        authorization: [session.permissionLevel],
        data: {
          payer: accountName,
          receiver: receiver,
          days: 1,
          net_frac: waxNetNum > 0 ? Math.floor(waxNetNum * 10000) : 0,
          cpu_frac: waxCpuNum > 0 ? Math.floor(waxCpuNum * 10000) : 0,
          max_payment: `${(waxCpuNum + waxNetNum).toFixed(8)} WAX`,
        },
      }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      const parts = [];
      if (waxCpuNum > 0) parts.push(`CPU: ${waxCpu} WAX`);
      if (waxNetNum > 0) parts.push(`NET: ${waxNet} WAX`);
      onTransactionSuccess?.('PowerUp Successful!', `Rented ${parts.join(', ')} for ${receiver}`, txId);
      setWaxCpu('');
      setWaxNet('');
      onTransactionComplete?.();
    } catch (error: any) {
      closeWharfkitModals();
      toast.error(error?.message || 'Failed to PowerUp');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  const canCheeseUp = isValidReceiver && totalCheese > 0 && totalCheese <= cheeseBalance && !isTransacting;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Receiver</Label>
        <div className="relative">
          <Input
            placeholder="Enter WAX account"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value.toLowerCase())}
            className="pr-10"
          />
          {receiver.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValidReceiver ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
            </div>
          )}
        </div>
      </div>

      <Tabs value={paymentMode} onValueChange={(v) => setPaymentMode(v as 'cheese' | 'wax')} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="cheese" className="flex-1 gap-2">
            <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
            CHEESEUp
          </TabsTrigger>
          <TabsTrigger value="wax" className="flex-1 gap-2">
            WAX PowerUp
          </TabsTrigger>
        </TabsList>

        {/* CHEESE Tab */}
        <TabsContent value="cheese" className="space-y-4 mt-4">
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground">
            Power up resources using CHEESE tokens via the CHEESEUp service. Resources last 24 hours.
            {cheeseBalance > 0 && (
              <span className="block mt-1 text-primary font-medium">
                Balance: {cheeseBalance.toLocaleString(undefined, { minimumFractionDigits: 4 })} CHEESE
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                CPU (CHEESE)
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                value={cheeseCpu}
                onChange={(e) => setCheeseCpu(e.target.value)}
                min={0}
              />
              {estimate && cheeseCpuNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {estimate.estimatedCpuMs.toFixed(2)} ms
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                NET (CHEESE)
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                value={cheeseNet}
                onChange={(e) => setCheeseNet(e.target.value)}
                min={0}
              />
              {estimate && cheeseNetNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatBytes(estimate.estimatedNetBytes)}
                </p>
              )}
            </div>
          </div>

          {totalCheese > 0 && (
            <div className="p-3 rounded-lg bg-muted/30 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{totalCheese.toFixed(4)} CHEESE</span>
              </div>
              {estimate && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">WAX equivalent</span>
                  <span className="text-xs text-muted-foreground">
                    ≈ {((estimate.cpuWaxAmount || 0) + (estimate.netWaxAmount || 0)).toFixed(8)} WAX
                  </span>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleCheeseUp}
            disabled={!canCheeseUp}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isTransacting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
            ) : (
              <><Zap className="mr-2 h-4 w-4" />CHEESEUp</>
            )}
          </Button>
        </TabsContent>

        {/* WAX Tab */}
        <TabsContent value="wax" className="space-y-4 mt-4">
          <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
            Rent resources using WAX PowerUp. Resources are rented for 24 hours and are non-refundable.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                CPU (WAX)
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                value={waxCpu}
                onChange={(e) => setWaxCpu(e.target.value)}
                min={0}
                step={0.00000001}
              />
              {estimate && waxCpuNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {estimate.estimatedCpuMs.toFixed(2)} ms
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                NET (WAX)
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                value={waxNet}
                onChange={(e) => setWaxNet(e.target.value)}
                min={0}
                step={0.00000001}
              />
              {estimate && waxNetNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatBytes(estimate.estimatedNetBytes)}
                </p>
              )}
            </div>
          </div>

          {(waxCpuNum > 0 || waxNetNum > 0) && (
            <div className="p-3 rounded-lg bg-muted/30 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{(waxCpuNum + waxNetNum).toFixed(8)} WAX</span>
              </div>
            </div>
          )}

          <Button
            onClick={() => handleWaxPowerup()}
            disabled={!isValidReceiver || (waxCpuNum <= 0 && waxNetNum <= 0) || isTransacting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isTransacting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
            ) : (
              <><Zap className="mr-2 h-4 w-4" />PowerUp</>
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
