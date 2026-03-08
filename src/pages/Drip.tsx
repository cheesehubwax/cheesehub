import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateDrip } from "@/components/drip/CreateDrip";
import { MyDrips } from "@/components/drip/MyDrips";
import { Droplets, List } from "lucide-react";
import cheeseDropOrb from "@/assets/cheesedrop.png";
import { playRandomFart } from "@/lib/fartSounds";

export default function Drip() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseDropOrb} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">💧</span>
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Drip</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">
                  BETA
                </span>
                <span className="text-2xl">💧</span>
              </div>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Create automated slow-drip token payments. Set up trustless payroll, vesting schedules, or recurring payments on WAX.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12">
        <Tabs defaultValue="create" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-md grid-cols-2 h-14">
              <TabsTrigger value="create" className="gap-2 text-base font-semibold h-12">
                <Droplets className="h-5 w-5" />
                Create Drip
              </TabsTrigger>
              <TabsTrigger value="my-drips" className="gap-2 text-base font-semibold h-12">
                <List className="h-5 w-5" />
                My Drips
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="create" className="flex justify-center">
            <div className="w-full max-w-lg">
              <CreateDrip />
            </div>
          </TabsContent>

          <TabsContent value="my-drips">
            <MyDrips />
          </TabsContent>
        </Tabs>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>
            Powered by the{" "}
            <a
              href="https://waxblock.io/account/waxdaoescrow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cheese hover:underline"
            >
              WAXDAOESCROW
            </a>{" "}
            smart contract.
          </p>
        </div>
      </main>
    </Layout>
  );
}
