import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { VAULT_DIR, vaultSupported } from '@/lib/cryptVault';

/** Locked screen shown until a private key is loaded: restore an existing key or create a new one. */
export function CryptKeySetup({ account, fileInput, profileEditor, creationDialog, fileRef, searchingVault, findKeyInFolder, makeKey }: {
  account: string; fileInput: ReactNode; profileEditor: ReactNode; creationDialog: ReactNode;
  fileRef: { current: HTMLInputElement | null }; searchingVault: boolean; findKeyInFolder: () => Promise<void>; makeKey: () => void;
}) {
  return (
    <div className="w-full max-w-md space-y-5 text-center">
      {fileInput}
    {profileEditor}
    {creationDialog}
      <div className="space-y-2">
        <p className="text-lg font-semibold">🔑 Unlock your messages</p>
        <p className="text-sm text-muted-foreground">
          Messages for <span className="font-semibold text-cheese">{account}</span> are encrypted. Load your private key file first —
          it stays on this device and is never sent anywhere.
        </p>
      </div>
      <div className="rounded-lg border border-cheese/40 bg-card/80 p-4 space-y-2 text-left">
        <p className="font-semibold text-sm">I already have a key</p>
        <p className="text-xs text-muted-foreground">Look in your Downloads for a file ending in <span className="font-mono">-key-PRIVATE.json</span>. Keys from the GPK Collection Manager work too.</p>
        <Button className="w-full bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => fileRef.current?.click()}>Load my private key</Button>
        {vaultSupported() && <Button className="w-full" variant="outline" disabled={searchingVault} onClick={() => void findKeyInFolder()}>{searchingVault ? 'Looking…' : `📁 Find it in my ${VAULT_DIR} folder`}</Button>}
        <p className="text-[11px] text-muted-foreground">Any file name works, including copies saved as .txt. Wallet-locked keys ask Anchor for one free signature that is never sent to the chain.</p>
      </div>
      <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2 text-left">
        <p className="font-semibold text-sm">I'm new here</p>
        <p className="text-xs text-muted-foreground">Choose your name and avatar first, then pay 100 CHEESE and save your new private key. Restoring an existing key is free. A new key cannot read messages sent to an older one.</p>
        <Button className="w-full" variant="outline" onClick={makeKey}>Create a new key</Button>
      </div>
    </div>
  );
}
