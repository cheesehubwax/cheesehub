import { Button } from '@/components/ui/button';

export function CryptLockGate({ account, busy, canLock, onLock, restoring, onRestore, unlock = false }: {
  account: string; busy: boolean; canLock: boolean; restoring: boolean;
  onLock: () => void; onRestore: () => void;
  unlock?: boolean;
}) {
  return <div className="w-full max-w-md space-y-4 border border-cheese/40 rounded-lg bg-card/80 p-6 text-center">
    <h2 className="text-lg font-semibold text-cheese">🔐 {unlock ? 'Unlock your saved key' : 'Lock key to continue'}</h2>
    <p className="text-sm text-muted-foreground">Your existing key must be locked to <span className="font-semibold text-cheese">{account}</span> before you can use CHEESECrypt. Your key, friends and rooms stay the same.</p>
    <p className="text-xs text-muted-foreground">Anchor asks for {unlock ? 'one free signature' : 'two free signatures'} that are never sent to the chain. Keep this tab open if signing is cancelled; you can retry without paying again.</p>
    {!canLock && <p className="text-sm text-destructive">Sign in with Anchor for this WAX account to continue.</p>}
    <Button className="w-full" disabled={busy || !canLock} onClick={onLock}>{busy ? (unlock ? 'Unlocking key…' : 'Locking key…') : unlock ? 'Unlock saved key with Anchor' : 'Lock key to continue'}</Button>
    <Button className="w-full" variant="outline" disabled={busy || restoring} onClick={onRestore}>Load another private key file</Button>
  </div>;
}