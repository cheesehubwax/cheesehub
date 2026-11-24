import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Keep a failed message local; never log decrypted content or replace its stored identity. */
export class CryptMessageBoundary extends Component<{ children: ReactNode; row?: boolean }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    const content = <>
      <span>{this.props.row ? 'Unable to display this message.' : 'Unable to display this conversation.'}</span>
      <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => this.setState({ failed: false })}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
      </Button>
    </>;
    return this.props.row
      ? <li role="alert" className="flex flex-wrap items-center gap-2 border border-destructive/40 rounded-md p-3 text-sm text-muted-foreground">{content}</li>
      : <div role="alert" className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-2 p-4 text-sm text-muted-foreground">{content}</div>;
  }
}