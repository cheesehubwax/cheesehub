import { Cpu, Wifi, Clock, TrendingUp, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { PowerUpEstimate } from "@/hooks/usePowerupEstimate";

interface ResourceEstimateProps {
  estimate: PowerUpEstimate | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const ResourceEstimate = ({
  estimate,
  isLoading,
  error,
  onRefresh
}: ResourceEstimateProps) => {
  const formatCpu = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
    return `${ms.toFixed(2)} ms`;
  };

  const formatNet = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes.toFixed(0)} bytes`;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl p-6 bg-card border border-border/50 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        <span className="text-muted-foreground">Fetching current rates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 text-sm">Failed to fetch rates</span>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    );
  }

  if (!estimate) {
    return null;
  }

  const hasCpu = estimate.estimatedCpuMs > 0;
  const hasNet = estimate.estimatedNetBytes > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Estimated Resources
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{estimate.powerupDays} day rental</span>
          </div>
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            title="Refresh rates"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {hasCpu && (
          <div className="rounded-xl p-4 bg-card border border-amber-500/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CPU Time</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {formatCpu(estimate.estimatedCpuMs)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-amber-500 text-sm font-semibold">
                  <TrendingUp className="w-4 h-4" />
                  <span>{estimate.cpuWaxAmount.toFixed(4)} WAX</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(100 - estimate.cpuUtilization).toFixed(1)}% available
                </p>
              </div>
            </div>
          </div>
        )}

        {hasNet && (
          <div className="rounded-xl p-4 bg-card border border-orange-400/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">NET Bandwidth</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {formatNet(estimate.estimatedNetBytes)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-orange-400 text-sm font-semibold">
                  <TrendingUp className="w-4 h-4" />
                  <span>{estimate.netWaxAmount.toFixed(4)} WAX</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(100 - estimate.netUtilization).toFixed(1)}% available
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl p-3 space-y-2 text-sm bg-card border border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">CHEESE/WAX Rate</span>
          <span className="font-mono text-amber-500">
            1 CHEESE = {estimate.cheesePriceInWax.toFixed(8)} WAX
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">CHEESE Price</span>
          <span className="font-mono text-foreground">
            ${estimate.cheeseUsdPrice.toFixed(6)} USD
          </span>
        </div>
        <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
          Estimates based on current network rates. Actual resources may vary.
        </p>
      </div>
    </div>
  );
};
