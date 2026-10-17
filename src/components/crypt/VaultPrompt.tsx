// One-time prompt after creating a key: save it into Desktop/cheesecrypt/my private key/.
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { MessagingKey } from '@/lib/cheeseCrypt';
import { DirHandle, FRIENDS_DIR, PRIVATE_DIR, VAULT_DIR, VaultFileExistsError, pickVault, privateKeyName, vaultSupported, writePrivateKey } from '@/lib/cryptVault';

export function VaultPrompt({ cryptKey, onSaved, onDownload }: {
  cryptKey: MessagingKey;
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
      else setError('Could not create the folders there. Try another location or download instead.');
    } finally { setBusy(false); }
  };

  return (
    // Closing without saving still downloads the backup, so a new key is never left unsaved.
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onDownload(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🔐 Keep your private key safe</DialogTitle>
          <DialogDescription>
            Your key works now. Save a backup — without it, a new browser or device can't read your messages.
          </DialogDescription>
        </DialogHeader>
        <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed overflow-x-auto">{`📁 Desktop/
└── 📁 ${VAULT_DIR}/
    ├── 📁 ${PRIVATE_DIR}/   ← secret, never share
    │   └── ${privateKeyName(cryptKey.account)}
    └── 📁 ${FRIENDS_DIR}/          ← your friends' public keys`}</pre>
        {supported ? (
          <p className="text-xs text-muted-foreground">
            A folder window opens on your Desktop — just press <span className="font-semibold text-foreground">Select</span> (or Allow).
            The folders are created for you. An existing key file is never overwritten.
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
              {busy ? 'Saving…' : `Save to Desktop/${VAULT_DIR}`}
            </Button>
          )}
          <Button variant="outline" disabled={busy} onClick={onDownload}>Download the file instead</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
