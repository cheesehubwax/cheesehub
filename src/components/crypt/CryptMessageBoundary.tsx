import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cryptDiagnostic, type CryptDiagnostic } from '@/lib/cryptDiagnostics';
import { clearCryptLookupCache } from '@/lib/cryptStorage';

/** Keep a failed message local; never log decrypted content or replace its stored identity. */
export class CryptMessageBoundary extends Component<{ children: ReactNode; row?: boolean; inline?: boolean }, { failed: boolean; diagnostic: CryptDiagnostic | null }> {
  state = { failed: false, diagnostic: null as CryptDiagnostic | null };

  static getDerivedStateFromError(error: unknown) { return { failed: true, diagnostic: cryptDiagnostic(error) }; }

  componentDidCatch(error: unknown) {
    // Never pass the exception object or raw stack to the console (may contain plaintext).
    console.error('[CHEESECrypt render failure]\n' + cryptDiagnostic(error).stack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const content = <>
      <span className="min-w-0 max-w-full">
        <span className="block">{this.props.row || this.props.inline ? 'Unable to display this message.' : 'Unable to display this conversation.'}</span>
        {this.state.diagnostic && <span className="mt-1 block break-words font-mono text-xs">{this.state.diagnostic.name}: {this.state.diagnostic.message}</span>}
      </span>
      {this.state.diagnostic?.storageQuota && <Button size="sm" variant="outline" onClick={() => {
        if (clearCryptLookupCache()) this.setState({ failed: false, diagnostic: null });
      }}>Clear lookup cache</Button>}
      <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => this.setState({ failed: false, diagnostic: null })}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
      </Button>
    </>;
    return this.props.row
      ? <li role="alert" className="flex flex-wrap items-center gap-2 border border-destructive/40 rounded-md p-3 text-sm text-muted-foreground">{content}</li>
      : <div role="alert" className={this.props.inline ? 'flex flex-wrap items-center gap-2 p-2 text-sm text-muted-foreground' : 'flex min-h-0 flex-1 flex-wrap items-center justify-center gap-2 p-4 text-sm text-muted-foreground'}>{content}</div>;
  }
}