import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { clearCryptLookupCache, getCryptStorageIssue, subscribeCryptStorage } from '@/lib/cryptStorage';

export function CryptStorageNotice() {
  const issue = useSyncExternalStore(subscribeCryptStorage, getCryptStorageIssue, () => null);
  const [retryFailed, setRetryFailed] = useState(false);
  if (!issue) return null;
  return <div role="alert" className="mb-4 flex w-full flex-wrap items-center gap-3 rounded-md border border-cheese/40 bg-card p-3 text-sm">
    <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
      <p className="font-semibold text-cheese">{issue === 'quota' ? 'Browser storage is full.' : 'Browser storage is unavailable.'}</p>
      <p className="text-muted-foreground">Changes may last only in this tab. Keep your key and friends backups.</p>
      {retryFailed && <p className="text-muted-foreground">Still unable to save. Free browser space or allow site storage, then retry.</p>}
    </div>
    <Button variant="outline" size="sm" onClick={() => setRetryFailed(!clearCryptLookupCache())}>Clear lookup cache</Button>
  </div>;
}