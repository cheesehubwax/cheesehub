import { useState, useEffect } from "react";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { useWax } from "@/context/WaxContext";
import {
  fetchUserLiquidityLocks,
  LiquidityLock,
  parseLPAsset,
  formatLiqUnlockTime,
  isLiqClaimable,
  getLiqTimeRemaining,
  getLiqLockStatus,
  LIQ_LOCK_STATUS,
  LIQLOCKER_CONTRACT,
  getDexDisplayName,
  getDexFromContract,
  LP_CONTRACTS,
  DEX
} from "@/lib/liqlocker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, RefreshCw, Clock, Droplets } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function MyLiquidityLocks() {
  const waxContext = useWax();
  const { toast } = useToast();
  const [locks, setLocks] = useState<LiquidityLock[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);

  const session = waxContext?.session ?? null;
  const accountName = waxContext?.accountName ?? null;

  const loadLocks = async () => {
    if (!session || !accountName) return;
    setLoading(true);
    try {
      const userLocks = await fetchUserLiquidityLocks(accountName);
      setLocks(Array.isArray(userLocks) ? userLocks : []);
    } catch (error) {
      console.error("Failed to load liquidity locks:", error);
      toast({ title: "Error", description: "Failed to load your liquidity locks", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session) {
      loadLocks();
    }
  }, [session]);

  const handleClaim = async (lock: LiquidityLock) => {
    if (!session) return;
    setClaiming(lock.ID);
    try {
      await session.transact({
        actions: [
          {
            account: LIQLOCKER_CONTRACT,
            name: "withdraw",
            authorization: [session.permissionLevel],
            data: { lock_ID: lock.ID },
          },
        ],
      }, { transactPlugins: getTransactPlugins(session) });
      toast({ title: "Success!", description: "LP tokens claimed successfully" });
      await loadLocks();
    } catch (error: any) {
      closeWharfkitModals();
      toast({ title: "Claim Failed", description: error.message || "Failed to claim LP tokens", variant: "destructive" });
    } finally {
      setClaiming(null);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  if (!session) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Connect your wallet to view your locked LP tokens
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Liquidity Locks</h2>
        <Button variant="outline" size="sm" onClick={loadLocks} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && locks.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : locks.length === 0 ? (
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Droplets className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              You don't have any locked LP tokens yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {locks.map((lock) => {
            const { amount, symbol } = parseLPAsset(lock.amount);
            const claimable = isLiqClaimable(lock);
            const timeRemaining = getLiqTimeRemaining(lock.unlock_time);
            const isWithdrawn = lock.status === LIQ_LOCK_STATUS.WITHDRAWN;
            const status = getLiqLockStatus(lock);
            const dex = getDexFromContract(lock.token_contract);

            return (
              <Card
                key={lock.ID}
                className={`transition-all ${claimable ? "border-cheese/50 cheese-glow" : ""}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-cheese" />
                      <span className="text-cheese">{symbol}</span>
                    </CardTitle>
                    <Badge
                      variant={status.variant}
                      className={claimable ? "bg-cheese text-cheese-foreground" : ""}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs flex items-center justify-between">
                    <span>ID: {lock.ID}</span>
                    <Badge variant="outline" className="text-xs">
                      {lock.token_contract === LP_CONTRACTS[DEX.DEFIBOX] ? "📦" : "🌮"} {dex ? getDexDisplayName(dex) : lock.token_contract}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-semibold">{amount} {symbol}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {claimable ? "Unlocked" : "Unlocks in"}
                    </span>
                    <span className="font-medium">
                      {isWithdrawn ? "-" : timeRemaining}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatLiqUnlockTime(lock.unlock_time)}
                  </div>
                  {claimable && (
                    <Button
                      onClick={() => handleClaim(lock)}
                      disabled={claiming === lock.ID}
                      className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
                    >
                      {claiming === lock.ID ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Unlock className="h-4 w-4 mr-2" />
                      )}
                      Claim LP Tokens
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
