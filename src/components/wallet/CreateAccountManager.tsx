import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { Loader2, Check, X, ShieldAlert } from 'lucide-react';
import { KeyPairGenerator } from './KeyPairGenerator';

interface CreateAccountManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

function isValidWaxAccountName(name: string): boolean {
  if (!name || name.length < 1 || name.length > 12) return false;
  if (name.startsWith('.') || name.endsWith('.')) return false;
  return /^[a-z1-5.]+$/.test(name);
}

function isValidPublicKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith('PUB_K1_') && key.length > 10) return true;
  if (key.startsWith('EOS') && key.length >= 50) return true;
  return false;
}

export function CreateAccountManager({ onTransactionComplete, onTransactionSuccess }: CreateAccountManagerProps) {
  const { session, accountName } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [newAccountName, setNewAccountName] = useState('');
  const [ownerKey, setOwnerKey] = useState('');
  const [activeKey, setActiveKey] = useState('');
  const [netStake, setNetStake] = useState('0.20000000');
  const [cpuStake, setCpuStake] = useState('0.20000000');
  const [ramBytes, setRamBytes] = useState('3000');
  const [transfer, setTransfer] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const nameValid = isValidWaxAccountName(newAccountName);
  const ownerKeyValid = isValidPublicKey(ownerKey);
  const activeKeyValid = isValidPublicKey(activeKey);
  const canSubmit = nameValid && ownerKeyValid && activeKeyValid && parseFloat(netStake) >= 0 && parseFloat(cpuStake) >= 0 && parseInt(ramBytes) > 0 && !isCreating;

  const handleCreate = async () => {
    if (!session || !canSubmit) return;
    setIsCreating(true);
    try {
      const actions = [
        { account: 'eosio', name: 'newaccount', authorization: [session.permissionLevel],
          data: { creator: accountName, name: newAccountName, owner: { threshold: 1, keys: [{ key: ownerKey, weight: 1 }], accounts: [], waits: [] }, active: { threshold: 1, keys: [{ key: activeKey, weight: 1 }], accounts: [], waits: [] } } },
        { account: 'eosio', name: 'buyrambytes', authorization: [session.permissionLevel],
          data: { payer: accountName, receiver: newAccountName, bytes: parseInt(ramBytes) } },
        { account: 'eosio', name: 'delegatebw', authorization: [session.permissionLevel],
          data: { from: accountName, receiver: newAccountName, stake_net_quantity: `${parseFloat(netStake).toFixed(8)} WAX`, stake_cpu_quantity: `${parseFloat(cpuStake).toFixed(8)} WAX`, transfer } },
      ];
      const result = await executeTransaction(actions, { showSuccessToast: false, showErrorToast: true, errorTitle: 'Account Creation Failed' });
      if (result.success) {
        onTransactionSuccess?.('Account Created!', `Created "${newAccountName}"`, result.txId);
        setNewAccountName(''); setOwnerKey(''); setActiveKey('');
        setNetStake('0.20000000'); setCpuStake('0.20000000'); setRamBytes('3000'); setTransfer(false);
        onTransactionComplete?.();
      }
    } finally { setIsCreating(false); }
  };

  const ValidationIcon = ({ valid, show }: { valid: boolean; show: boolean }) => {
    if (!show) return null;
    return valid ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Create New WAX Account</h3>
      <div className="space-y-2">
        <Label>Account Name</Label>
        <div className="relative">
          <Input placeholder="1-12 chars (a-z, 1-5, period)" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value.toLowerCase())} className="pr-10" maxLength={12} />
          <div className="absolute right-3 top-1/2 -translate-y-1/2"><ValidationIcon valid={nameValid} show={newAccountName.length > 0} /></div>
        </div>
        {newAccountName.length > 0 && !nameValid && <p className="text-xs text-destructive">Must be 1-12 chars: a-z, 1-5, periods</p>}
      </div>
      <KeyPairGenerator onUseAsOwnerKey={setOwnerKey} onUseAsActiveKey={setActiveKey} />
      <div className="space-y-2">
        <Label>Public Owner Key</Label>
        <div className="relative"><Input placeholder="PUB_K1... or EOS..." value={ownerKey} onChange={(e) => setOwnerKey(e.target.value.trim())} className="pr-10 font-mono text-xs" /><div className="absolute right-3 top-1/2 -translate-y-1/2"><ValidationIcon valid={ownerKeyValid} show={ownerKey.length > 0} /></div></div>
      </div>
      <div className="space-y-2">
        <Label>Public Active Key</Label>
        <div className="relative"><Input placeholder="PUB_K1... or EOS..." value={activeKey} onChange={(e) => setActiveKey(e.target.value.trim())} className="pr-10 font-mono text-xs" /><div className="absolute right-3 top-1/2 -translate-y-1/2"><ValidationIcon valid={activeKeyValid} show={activeKey.length > 0} /></div></div>
      </div>
      <div className="space-y-2"><Label>NET to Stake (WAX)</Label><Input type="number" value={netStake} onChange={(e) => setNetStake(e.target.value)} min={0} step={0.00000001} /></div>
      <div className="space-y-2"><Label>CPU to Stake (WAX)</Label><Input type="number" value={cpuStake} onChange={(e) => setCpuStake(e.target.value)} min={0} step={0.00000001} /></div>
      <div className="space-y-2"><Label>RAM to Buy (bytes)</Label><Input type="number" value={ramBytes} onChange={(e) => setRamBytes(e.target.value)} min={1} step={1} /></div>
      <div className="flex items-center space-x-2">
        <Checkbox id="transfer-stake" checked={transfer} onCheckedChange={(checked) => setTransfer(checked === true)} />
        <Label htmlFor="transfer-stake" className="cursor-pointer text-sm">Transfer staked resources to new account</Label>
      </div>
      <Button onClick={handleCreate} disabled={!canSubmit} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
        {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Account...</> : 'Create Account'}
      </Button>
    </div>
  );
}
