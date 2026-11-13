import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RiskAcknowledgement } from "@/components/shared/RiskAcknowledgement";
import { fetchDepositAddress, formatRawUnits } from "@/lib/alcorBridge";

/** Permanent personal deposit address (Ethereum, BSC, Polygon) paying out to the WAX account. */
export function DepositAddressPanel({ account, idSuffix = "page" }: { account: string | null; idSuffix?: string }) {
  const [agreed, setAgreed] = useState(false);
  const [requested, setRequested] = useState(false);
  const q = useQuery({
    queryKey: ["alcor-bridge-deposit", account],
    queryFn: () => fetchDepositAddress(account!),
    enabled: !!account && requested,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  if (!account) return <p className="text-sm text-muted-foreground">Connect your wallet to get your deposit address.</p>;

  if (!q.data) {
    return (
      <div className="space-y-3">
        <RiskAcknowledgement kind="bridge" id={`bridge-terms-${idSuffix}`} checked={agreed} onCheckedChange={setAgreed} />
        <Button disabled={!agreed || q.isFetching} onClick={() => setRequested(true)} className="w-full">
          {q.isFetching ? "Getting address…" : "Show my deposit address"}
        </Button>
        {q.isError && <p className="text-sm text-destructive">Could not get an address: {(q.error as Error).message}</p>}
      </div>
    );
  }

  const d = q.data;
  const copy = () => navigator.clipboard.writeText(d.address).then(() => toast.success("Address copied"));
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-lg bg-foreground p-3"><QRCodeSVG value={d.address} size={160} /></div>
        <div className="flex items-center gap-2 w-full">
          <code className="flex-1 text-xs break-all rounded bg-muted p-2">{d.address}</code>
          <Button size="icon" variant="outline" onClick={copy} aria-label="Copy address"><Copy className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">Arrives at <span className="text-cheese">{account}</span> on WAX. You can withdraw straight from an exchange to this address.</p>
      </div>
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs">
        ⚠️ Only send on the networks and tokens below. Sending on any other network (Arbitrum, Base, Tron…) or a token not listed may lose the money. Amounts below the minimum wait at the address until more arrives.
      </div>
      {d.chains.map((c) => (
        <div key={c.id} className="text-xs">
          <h4 className="font-semibold text-sm mb-1">{c.name}</h4>
          <ul className="space-y-0.5">
            {c.tokens.map((t) => (
              <li key={t.symbol} className="flex justify-between">
                <span>{t.symbol}</span>
                <span className="text-muted-foreground">min {formatRawUnits(t.min, t.decimals) ?? "unavailable"}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">No bridge fee; up to 1% of the deposit pays forwarding gas. Alcor operates this service — CHEESEHub never holds or controls these funds.</p>
    </div>
  );
}
