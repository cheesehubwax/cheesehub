import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { OpenMojiIcon } from "@/components/OpenMojiIcon";
import { DappAbout, aboutGuides } from "@/components/about/DappAbout";
import { TermsCheckbox } from "@/components/shared/TermsCheckbox";
import { BridgeWidget } from "@/components/bridge/BridgeWidget";
import { BridgeRoutesCard } from "@/components/bridge/BridgeRoutesCard";
import { BridgeTransfersCard } from "@/components/bridge/BridgeTransfersCard";
import { DepositAddressPanel } from "@/components/bridge/DepositAddressPanel";
import { useWax } from "@/context/WaxContext";

export default function Bridge() {
  const { accountName } = useWax();
  const [agreed, setAgreed] = useState(false);

  return (
    <Layout>
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center">
              <OpenMojiIcon emoji="🌉" size={72} />
            </div>
            <div className="text-center space-y-2">
              <DappAbout {...aboutGuides.bridge}>
                <div className="flex items-center justify-center gap-2">
                  <OpenMojiIcon emoji="🌉" size={24} />
                  <h1 className="text-3xl md:text-4xl font-bold">
                    <span className="text-cheese">ALCOR</span>
                    <span className="text-foreground">Bridge</span>
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                  <OpenMojiIcon emoji="🌉" size={24} />
                </div>
              </DappAbout>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Move USDC, USDT, ETH, BNB and POL between Ethereum, BNB Smart Chain, Polygon and WAX using Alcor's bridge.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12">
        <Tabs defaultValue="bridge" className="space-y-8">
          <div className="flex justify-center mb-6">
            <TabsList className="bg-card/80 border border-border/50 h-10">
              <TabsTrigger value="bridge" className="gap-1.5 text-sm px-4"><OpenMojiIcon emoji="🔁" size={14} /> Bridge</TabsTrigger>
              <TabsTrigger value="deposit" className="gap-1.5 text-sm px-4"><OpenMojiIcon emoji="📥" size={14} /> Deposit Address</TabsTrigger>
            </TabsList>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div>
              <TabsContent value="bridge" className="mt-0">
                {agreed ? (
                  <BridgeWidget recipient={accountName} />
                ) : (
                  <Card className="max-w-[480px] mx-auto bg-card/80 border-border/50">
                    <CardContent className="pt-6 space-y-3 text-sm">
                      <p>The bridge is operated by Alcor, a third party. CHEESEHub never holds, routes or signs your funds. Check the network, token and amount before signing in your wallet.</p>
                      <TermsCheckbox id="bridge-terms-widget" checked={agreed} onCheckedChange={setAgreed} />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              <TabsContent value="deposit" className="mt-0">
                <Card className="max-w-[480px] mx-auto bg-card/80 border-border/50">
                  <CardContent className="pt-6"><DepositAddressPanel account={accountName} /></CardContent>
                </Card>
              </TabsContent>
            </div>
            <div className="space-y-6">
              <BridgeTransfersCard account={accountName} />
              <BridgeRoutesCard />
            </div>
          </div>
        </Tabs>

        <p className="text-center mt-8 text-sm text-muted-foreground">
          Powered by{" "}
          <a href="https://docs.alcor.exchange/api/bridge" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">Alcor Bridge</a>
        </p>
      </main>
    </Layout>
  );
}
