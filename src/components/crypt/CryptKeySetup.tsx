import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { VAULT_DIR, vaultSupported } from '@/lib/cryptVault';

/** Locked screen shown until a private key is loaded: restore an existing key or create a new one. */
export function CryptKeySetup({ account, fileInput, profileEditor, creationDialog, fileRef, searchingVault, hasSavedVault, openSavedFolder, pickFolder, makeKey, canCreate = true }: {
  account: string; fileInput: ReactNode; profileEditor: ReactNode; creationDialog: ReactNode;
  fileRef: { current: HTMLInputElement | null }; searchingVault: boolean; hasSavedVault: boolean;
  openSavedFolder: () => void; pickFolder: () => void; makeKey: () => void;
  canCreate?: boolean;
}) {
  return (
    <div className="w-full max-w-md space-y-5 text-center">
      {fileInput}
    {profileEditor}
    {creationDialog}
      <div className="space-y-2">
        <p className="text-lg font-semibold">🔑 Unlock your messages</p>
        <p className="text-sm text-muted-foreground">
          Messages for <span className="font-semibold text-cheese">{account}</span> are encrypted. Load your private key first —
          it stays on this device and is never sent anywhere.
        </p>
      </div>
      <div className="rounded-lg border border-cheese/40 bg-card/80 p-4 space-y-2 text-left">
        <p className="font-semibold text-sm">I already have a key</p>
        <p className="text-xs text-muted-foreground">
          Your <span className="font-mono">{VAULT_DIR}</span> folder holds your private key and your friends' keys, so every
          browser and site on this computer can pick them up. Open it once here and your key, friends and rooms are found automatically.
        </p>
        {vaultSupported() && (
          <>
            <Button className="w-full bg-cheese text-primary-foreground hover:bg-cheese/90" disabled={searchingVault} onClick={openSavedFolder}>
              {searchingVault ? 'Looking…' : hasSavedVault ? `🔓 Unlock my saved ${VAULT_DIR} folder` : `📁 Open my ${VAULT_DIR} folder`}
            </Button>
            {hasSavedVault && (
              <Button className="w-full" variant="outline" disabled={searchingVault} onClick={pickFolder}>Choose another folder</Button>
            )}
          </>
        )}
        <Button className="w-full" variant="outline" onClick={() => fileRef.current?.click()}>Load my private key file</Button>
        <p className="text-[11px] text-muted-foreground">Look in your Downloads for a file ending in <span className="font-mono">-key-PRIVATE.json</span>. Keys from the GPK Collection Manager work too. Any file name works, including copies saved as .txt. Wallet-locked keys ask Anchor for one free signature that is never sent to the chain.</p>
      </div>
      <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2 text-left">
        <p className="font-semibold text-sm">I'm new here</p>
        <p className="text-xs text-muted-foreground">Choose your name and avatar first, then pay 100 CHEESE and lock your key to this WAX account with two free Anchor signatures. Only wallet-locked backups are saved. Restoring an existing key is free. A new key cannot read messages sent to an older one.</p>
        {!canCreate && <p className="text-xs text-destructive">Sign in with Anchor to create or unlock your messaging key.</p>}
        <Button className="w-full" variant="outline" disabled={!canCreate} onClick={makeKey}>Create a new key</Button>
      </div>
    </div>
  );
}
