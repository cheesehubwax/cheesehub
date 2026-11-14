import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import alcorIconUrl from "@/assets/alcor-icon.svg";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RiskAcknowledgement } from "@/components/shared/RiskAcknowledgement";
import { useWax } from "@/context/WaxContext";
import { cn } from "@/lib/utils";
import { BridgeWidget } from "./BridgeWidget";
import { BridgeRoutesCard } from "./BridgeRoutesCard";
import { BridgeTransfersCard } from "./BridgeTransfersCard";
import { DepositAddressPanel } from "./DepositAddressPanel";

export const OPEN_ALCOR_BRIDGE_EVENT = "open-alcor-bridge";
export const openAlcorBridge = () => window.dispatchEvent(new CustomEvent(OPEN_ALCOR_BRIDGE_EVENT));

/** ALCORBridge as a global modal, like CHEESESwap. Route status is a collapsible side panel. */
export function AlcorBridgeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { accountName } = useWax();
  const [agreed, setAgreed] = useState(false);
  const [tab, setTab] = useState("bridge");
  const [routesOpen, setRoutesOpen] = useState(false);
  const wide = tab === "bridge" && routesOpen;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden border-cheese/30 bg-background p-0 transition-[max-width] duration-300 sm:max-h-[calc(100dvh-2rem)]",
          wide ? "max-w-[520px] lg:max-w-[940px]" : "max-w-[520px]",
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border/50 bg-background p-3 pr-10 sm:p-4 sm:pb-3 sm:pr-10">
          <div className="flex items-center gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <img src={alcorIconUrl} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 object-contain" />
              <span><span className="text-cheese">ALCOR</span><span className="text-foreground">Bridge</span></span>
            </DialogTitle>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
            <span className="text-xs text-muted-foreground">
              powered by <a href="https://docs.alcor.exchange/api/bridge" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">Alcor Exchange</a>
            </span>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Bridge USDC, USDT, ETH, BNB and POL from Ethereum, BNB Smart Chain or Polygon onto the WAX blockchain.
          </DialogDescription>
        </DialogHeader>

        <div className="relative isolate min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-4">
          {tab === "bridge" && (
            <img
              src={alcorIconUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[85%] max-w-[720px] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-10"
            />
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <div className="mb-4 flex justify-center">
              <TabsList className="bg-card/80 border border-border/50 h-10">
                <TabsTrigger value="bridge" className="text-sm px-3">Bridge</TabsTrigger>
                <TabsTrigger value="deposit" className="text-sm px-3">Deposit Address</TabsTrigger>
                <TabsTrigger value="history" className="text-sm px-3">History</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="bridge" className="mt-0">
              <div className="mb-3 flex justify-center">
                <Button variant="outline" size="sm" className={cn("h-7 bg-accent text-xs text-accent-foreground hover:bg-accent/80", !routesOpen && "animate-glow-pulse")} onClick={() => setRoutesOpen((v) => !v)} aria-expanded={routesOpen}>
                  Route status {routesOpen ? <ChevronLeft className="ml-1 h-3 w-3" aria-hidden="true" /> : <ChevronRight className="ml-1 h-3 w-3" aria-hidden="true" />}
                </Button>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 lg:flex-row lg:items-start lg:gap-0">
                <div className="w-full max-w-[480px] shrink-0">
                  {agreed ? (
                    <BridgeWidget recipient={accountName} />
                  ) : (
                    <div className="space-y-3 rounded-lg border border-border/50 bg-card/80 p-4 text-sm">
                      <p>The bridge is operated by Alcor, a third party. CHEESEHub never holds, routes or signs your funds. Check the network, token and amount before signing in your wallet.</p>
                      <RiskAcknowledgement kind="bridge" id="bridge-terms-modal" checked={agreed} onCheckedChange={setAgreed} />
                    </div>
                  )}
                </div>
                {routesOpen && (
                  <div className="w-full max-w-[480px] shrink-0 lg:w-[400px] lg:-ml-px [&>div]:lg:rounded-l-none">
                    <BridgeRoutesCard />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="deposit" className="mt-0">
              <div className="alcor-panel mx-auto max-w-[480px] rounded-lg border border-border p-4 font-sans">
                <DepositAddressPanel account={accountName} idSuffix="modal" />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="mx-auto max-w-[480px]"><BridgeTransfersCard account={accountName} /></div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
