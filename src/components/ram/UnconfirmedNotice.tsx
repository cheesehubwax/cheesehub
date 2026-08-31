import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UnconfirmedState {
  /** True while we are still polling the chain for the transaction. */
  checking: boolean;
  /** Account to link to on the block explorer. */
  account: string;
  /** Extra context, e.g. what was signed. */
  detail: string;
}

interface UnconfirmedNoticeProps {
  state: UnconfirmedState;
  /** Called when the user confirms they checked their wallet and wants to retry. */
  onAcknowledge: () => void;
}

/**
 * Shown when a transaction was signed but the broadcast reply was lost. The
 * transaction may already be on-chain, so retrying blindly can repeat it.
 */
export function UnconfirmedNotice({ state, onAcknowledge }: UnconfirmedNoticeProps) {
  return (
    <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-500">
            {state.checking ? 'Checking the blockchain…' : 'Transaction not confirmed'}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {state.checking
              ? 'Your transaction was signed but we lost the reply. Looking it up on-chain before you do anything else.'
              : `Your transaction was signed and may already be on-chain — we could not confirm it. ${state.detail} Check your account on waxblock.io before retrying, because retrying may repeat it.`}
          </p>
        </div>
      </div>

      {!state.checking && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://waxblock.io/account/${state.account}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View {state.account} on waxblock.io
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAcknowledge}
            className="ml-auto h-7 px-3 text-xs border-amber-500/50 hover:bg-amber-500/10"
          >
            I checked — let me retry
          </Button>
        </div>
      )}

      {state.checking && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Verifying…
        </div>
      )}
    </div>
  );
}
