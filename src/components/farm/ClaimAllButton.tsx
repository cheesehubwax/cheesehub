import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FarmInfo } from "@/lib/farm";
import { fetchUserStakerRows, splitReadyFarms, sumRewards } from "@/lib/farmClaimAll";
import { farmTimings, fmtList } from "./ClaimAllFarmsDialog";

interface Props { account: string; farms: FarmInfo[]; onClick: () => void }

/** Claim All button with a hover summary of rewards ready now (shares the dialog's cached read). */
export function ClaimAllButton({ account, farms, onClick }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["farmClaimAll", account],
    queryFn: () => fetchUserStakerRows(account),
    staleTime: 45_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const { ready, empty } = useMemo(
    () => splitReadyFarms(data?.rows ?? [], farmTimings(farms), Math.floor(Date.now() / 1000)),
    [data, farms]);
  const totals = sumRewards(ready);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" onClick={onClick}>
          🧀 Claim All{data && ready.length > 0 ? ` (${ready.length})` : ""}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {isLoading ? <p className="text-xs">Checking ready rewards…</p>
          : isError || !data ? <p className="text-xs">Couldn't check rewards right now.</p>
          : ready.length === 0 ? (
            <p className="text-xs">No rewards ready yet{empty.length ? ` (staked in ${empty.length} farm${empty.length === 1 ? "" : "s"})` : ""}.</p>
          ) : (
            <div className="space-y-1">
              {totals.map(t => <p key={`${t.contract}:${t.symbol}`} className="text-xs text-cheese font-medium">{fmtList([t])}</p>)}
              <p className="text-xs text-muted-foreground">Ready across {ready.length} farm{ready.length === 1 ? "" : "s"}</p>
            </div>
          )}
        {data?.partial && <p className="text-xs text-destructive mt-1">Some staked farms couldn't be read.</p>}
      </TooltipContent>
    </Tooltip>
  );
}
