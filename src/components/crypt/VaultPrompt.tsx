// One-time prompt after creating a key: save it into Desktop/cheesecrypt/my private key/.
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { LockedKeyFile } from '@/lib/cryptKeyLock';
import { DirHandle, FRIENDS_DIR, PRIVATE_DIR, VAULT_DIR, VaultFileExistsError, pickVault, privateKeyName, vaultSupported, writePrivateKey } from '@/lib/cryptVault';

export function VaultPrompt({ cryptKey, onSaved, onDownload }: {
  cryptKey: LockedKeyFile;
  onSaved: (root: DirHandle) => void;
  onDownload: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = vaultSupported();

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const root = await pickVault();
      await writePrivateKey(root, cryptKey);
      onSaved(root);
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') setError(null);
      else if (e instanceof VaultFileExistsError) setError(`${e.path} already exists, so nothing was saved. Move or rename the old file, then try again — or download instead.`);
      else if (['SecurityError', 'NotAllowedError'].includes((e as DOMException)?.name)) setError(`Chrome may block access to the Desktop itself, or folder permission was denied. Try again: on your Desktop, create or select the ${VAULT_DIR} folder, then allow access to that folder — not the Desktop itself. You can also download instead.`);
      else setError(`Could not save there. Try again and create or select a ${VAULT_DIR} folder on your Desktop, allow access to it, or download instead.`);
    } finally { setBusy(false); }
  };

  return (
    // Closing without saving still downloads the backup, so a new key is never left unsaved.
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onDownload(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🔐 Keep your private key safe</DialogTitle>
          <DialogDescription>
            Your key is locked to your WAX account. Save this backup and keep access to your Anchor wallet — both are needed on a new browser or device.
          </DialogDescription>
        </DialogHeader>
        <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed overflow-x-auto">{`📁 Desktop/
└── 📁 ${VAULT_DIR}/
    ├── 📁 ${PRIVATE_DIR}/   ← secret, never share
    │   └── ${privateKeyName(cryptKey.account)}
    └── 📁 ${FRIENDS_DIR}/          ← your friends' public keys`}</pre>
        {supported ? (
          <p className="text-xs text-muted-foreground">
            In the folder window, go to your Desktop. Click <span className="font-semibold text-foreground">New folder</span> and
            name it <span className="font-mono text-foreground">{VAULT_DIR}</span>, or open that folder if it already exists.
            Select the <span className="font-mono text-foreground">{VAULT_DIR}</span> folder and allow access — not the Desktop itself.
            The {PRIVATE_DIR} and {FRIENDS_DIR} subfolders are created for you. An existing key file is never overwritten.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            This browser can't create folders. Download the file and move it into <span className="font-mono">Desktop/{VAULT_DIR}/{PRIVATE_DIR}/</span> yourself. Chrome, Edge or Brave can do it automatically.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex flex-col gap-2">
          {supported && (
            <Button disabled={busy} onClick={save} className="bg-cheese text-primary-foreground hover:bg-cheese/90">
              {busy ? 'Saving…' : `Choose Desktop/${VAULT_DIR} folder`}
            </Button>
          )}
          <Button variant="outline" disabled={busy} onClick={onDownload}>Download the file instead</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
