// CHEESEAir — terms gate, run/cancel controls, CSV export and the live logs.
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { formatCheese } from '@/lib/airdropResources';
import { CHEESE_SYMBOL, MIN_RAM_PURCHASE_CHEESE, txLink } from '@/lib/airdropCheese';
import { useAirdrop } from './AirdropContext';

export function AirRunPanel() {
  const {
    actor,
    warnings,
    runError,
    runState,
    recipientCount,
    canRun,
    runAirdrop,
    cancelRequested,
    requestCancel,
    downloadCsv,
    purchaseLog,
    batchLog,
    termsAccepted,
    setTermsAccepted,
  } = useAirdrop();

  const errors = warnings.filter((w) => w.level === 'error');
  const notes = warnings.filter((w) => w.level === 'warn');
  const completed = batchLog.filter((b) => b.txId).length;

  return (
    <Card className="border-cheese/20 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <OpenMojiIcon emoji="🪂" size={18} />
          Run the airdrop
        </h2>

        {runError && <p className="mb-3 text-xs text-destructive">{runError}</p>}

        {errors.length > 0 && (
          <div className="mb-3 space-y-1">
            {errors.map((w, i) => (
              <p key={i} className="text-xs text-destructive">
                {w.message}
              </p>
            ))}
          </div>
        )}
        {notes.length > 0 && (
          <div className="mb-3 space-y-1">
            {notes.map((w, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {w.message}
              </p>
            ))}
          </div>
        )}

        <TermsCheckbox
          id="air-terms"
          checked={termsAccepted}
          onCheckedChange={setTermsAccepted}
          className="mb-3"
        />

        <div className="flex flex-wrap gap-2">
          {runState !== 'running' ? (
            <Button onClick={runAirdrop} disabled={!canRun} className="font-bold">
              AIRDROP {recipientCount > 0 && `(${recipientCount.toLocaleString()} recipients)`}
            </Button>
          ) : (
            <Button variant="destructive" onClick={requestCancel} disabled={cancelRequested}>
              {cancelRequested ? 'Cancelling…' : 'Cancel after current batch'}
            </Button>
          )}
          {recipientCount > 0 && (
            <Button variant="outline" onClick={downloadCsv}>
              Download CSV
            </Button>
          )}
        </div>

        {!actor ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Connect your wallet to enable the airdrop.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Every airdrop starts with a RAM purchase of at least{' '}
            {formatCheese(MIN_RAM_PURCHASE_CHEESE)} {CHEESE_SYMBOL} (kept by your account, and
            sellable afterwards). CPU and NET are topped up with {CHEESE_SYMBOL} only when needed.
            You will be asked to sign these purchases before the first batch.
          </p>
        )}

        {purchaseLog.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-md border border-border bg-background p-2 font-mono text-xs">
            {purchaseLog.map((p, i) => (
              <div key={i} className="flex items-start gap-2 py-0.5">
                {p.txId ? (
                  <>
                    <span className="text-muted-foreground">
                      {p.kind === 'cpu' ? 'CPU/NET' : 'RAM'} · {formatCheese(p.cheese)}{' '}
                      {CHEESE_SYMBOL} ·{' '}
                    </span>
                    <a
                      href={txLink(p.txId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-cheese hover:underline"
                    >
                      {p.txId.slice(0, 16)}…
                    </a>
                  </>
                ) : (
                  <span className="text-destructive">
                    {p.kind === 'cpu' ? 'CPU/NET' : 'RAM'} · {formatCheese(p.cheese)}{' '}
                    {CHEESE_SYMBOL} · {p.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {batchLog.length > 0 && (
          <div className="mt-4 max-h-64 overflow-y-auto rounded-md border border-border bg-background p-2 font-mono text-xs">
            {batchLog.map((b) => (
              <div key={b.batch} className="flex items-start gap-2 py-0.5">
                {b.txId ? (
                  <>
                    <span className="text-muted-foreground">
                      batch {b.batch} · {b.recipients} transfers ·{' '}
                    </span>
                    <a
                      href={txLink(b.txId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-cheese hover:underline"
                    >
                      {b.txId.slice(0, 20)}…
                    </a>
                  </>
                ) : (
                  <span className="text-destructive">
                    batch {b.batch} · {b.recipients} transfers · {b.error}
                  </span>
                )}
              </div>
            ))}
            {runState === 'done' && (
              <div className="mt-1 border-t border-border pt-1 text-foreground">
                Done · {completed} of {batchLog.length} batches confirmed
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
