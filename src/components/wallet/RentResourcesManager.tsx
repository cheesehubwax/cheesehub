import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWax } from '@/context/WaxContext';
import { Loader2, Check, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';

interface RentResourcesManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

export function RentResourcesManager({ onTransactionComplete, onTransactionSuccess }: RentResourcesManagerProps) {
  const { session, accountName } = useWax();
  const [isTransacting, setIsTransacting] = useState(false);
  const [receiver, setReceiver] = useState('');
  const [cpuAmount, setCpuAmount] = useState('');
  const [netAmount, setNetAmount] = useState('');

  const isValidReceiver = receiver.length > 0 && isValidWaxAccount(receiver);

  useState(() => {
    if (accountName) setReceiver(accountName);
  });

  const handleRentCpu = async () => {
    if (!session || !isValidReceiver || !cpuAmount) return;
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
          net_frac: 0,
          cpu_frac: Math.floor(parseFloat(cpuAmount) * 10000),
          max_payment: `${parseFloat(cpuAmount).toFixed(8)} WAX`,
        },
      }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('CPU Rented!', `Rented CPU for ${receiver} with ${cpuAmount} WAX`, txId);
      setCpuAmount('');
      onTransactionComplete?.();
    } catch (error: any) {
      closeWharfkitModals();
      toast.error(error?.message || 'Failed to rent CPU');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  const handleRentNet = async () => {
    if (!session || !isValidReceiver || !netAmount) return;
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
          net_frac: Math.floor(parseFloat(netAmount) * 10000),
          cpu_frac: 0,
          max_payment: `${parseFloat(netAmount).toFixed(8)} WAX`,
        },
      }];
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('NET Rented!', `Rented NET for ${receiver} with ${netAmount} WAX`, txId);
      setNetAmount('');
      onTransactionComplete?.();
    } catch (error: any) {
      closeWharfkitModals();
      toast.error(error?.message || 'Failed to rent NET');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Rent CPU/NET</h3>
      </div>

      <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        Rent resources using WAX PowerUp. Resources are rented for 24 hours and are non-refundable.
      </div>

      <div className="space-y-2">
        <Label>Receiver</Label>
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

      <Tabs defaultValue="cpu" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="cpu" className="flex-1">Rent CPU</TabsTrigger>
          <TabsTrigger value="net" className="flex-1">Rent NET</TabsTrigger>
        </TabsList>

        <TabsContent value="cpu" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>WAX to spend on CPU</Label>
            <Input
              type="number"
              placeholder="Amount in WAX"
              value={cpuAmount}
              onChange={(e) => setCpuAmount(e.target.value)}
              min={0}
              step={0.00000001}
            />
          </div>
          <Button
            onClick={handleRentCpu}
            disabled={!isValidReceiver || !cpuAmount || isTransacting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isTransacting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Renting CPU...</> : 'Rent CPU'}
          </Button>
        </TabsContent>

        <TabsContent value="net" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>WAX to spend on NET</Label>
            <Input
              type="number"
              placeholder="Amount in WAX"
              value={netAmount}
              onChange={(e) => setNetAmount(e.target.value)}
              min={0}
              step={0.00000001}
            />
          </div>
          <Button
            onClick={handleRentNet}
            disabled={!isValidReceiver || !netAmount || isTransacting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isTransacting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Renting NET...</> : 'Rent NET'}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
