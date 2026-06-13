import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BarChart3, ChevronDown, ChevronUp, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { fetchFarmStakableConfig } from "@/lib/farm";
import { TEMPLATE_DISTRIBUTION_MAX } from "@/lib/farmTemplateStats";
import { useFarmTemplateDistribution } from "@/hooks/useFarmTemplateDistribution";

interface FarmTemplateDistributionProps {
  farmName: string;
}

function formatNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

function formatPct(p: number | null): string {
  if (p === null) return "—";
  if (p >= 10) return `${p.toFixed(1)}%`;
  return `${p.toFixed(2)}%`;
}

export function FarmTemplateDistribution({ farmName }: FarmTemplateDistributionProps) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const configQuery = useQuery({
    queryKey: ["farmStakableConfig", farmName],
    queryFn: () => fetchFarmStakableConfig(farmName),
    staleTime: 60_000,
  });

  const templates = configQuery.data?.templates ?? [];
  const templateCount = templates.length;
  const tooMany = templateCount > TEMPLATE_DISTRIBUTION_MAX;

  const { rows, isFetching, refetch } = useFarmTemplateDistribution(
    farmName,
    tooMany ? [] : templates,
    enabled && !tooMany && templateCount > 0,
  );

  const loaded = rows.length > 0;

  // Farms without templates: nothing to show. Render after all hooks have
  // been called so hook order stays stable across loading/loaded states.
  if (configQuery.isLoading) {
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }
  if (templateCount === 0) return null;

  return (
    <Card className="bg-card/80 border-border/50">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-cheese" />
              Template Distribution
              <Badge variant="outline" className="ml-2 text-xs">
                {templateCount} template{templateCount === 1 ? "" : "s"} · owner-only
              </Badge>
              {tooMany && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  &gt; {TEMPLATE_DISTRIBUTION_MAX} templates · unavailable
                </span>
              )}
            </CardTitle>
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {tooMany ? (
              <p className="text-sm text-muted-foreground py-2">
                Template distribution is only available for farms with up to{" "}
                {TEMPLATE_DISTRIBUTION_MAX} templates. This farm accepts {templateCount}.
              </p>
            ) : !enabled ? (
              <div className="py-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Show how many NFTs of each template are staked in this farm, as a
                  percentage of issued and max supply. Computing fires up to{" "}
                  {templateCount * 2} AtomicAssets requests.
                </p>
                <Button
                  onClick={() => setEnabled(true)}
                  className="w-full sm:w-auto bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                >
                  Compute distribution
                </Button>
              </div>
            ) : isFetching && !loaded ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading {templateCount} template{templateCount === 1 ? "" : "s"}…
                </div>
                {Array.from({ length: Math.min(templateCount, 5) }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {rows.length} template{rows.length === 1 ? "" : "s"} · sorted by circulating %
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refetch}
                    disabled={isFetching}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
                    Recompute
                  </Button>
                </div>
                <div className="rounded-md border border-border/50 overflow-hidden divide-y divide-border/40">
                  {rows.map((r) => {
                    const pctValue = r.circulatingPct ?? 0;
                    const ahUrl = `https://atomichub.io/explorer/template/wax-mainnet/${r.collection}/${r.templateId}`;
                    return (
                      <div
                        key={`${r.collection}:${r.templateId}`}
                        className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 items-center p-2 hover:bg-muted/30"
                      >
                        <a
                          href={ahUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-10 h-10 rounded bg-muted overflow-hidden shrink-0"
                          aria-label={`Template ${r.templateId}`}
                        >
                          <img
                            src={r.image}
                            alt={r.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                        </a>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <a
                              href={ahUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium truncate hover:underline"
                            >
                              {r.name}
                            </a>
                            <span className="text-xs text-muted-foreground font-mono shrink-0">
                              #{r.templateId}
                            </span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.collection}
                          </div>
                          <div className="mt-1">
                            <Progress value={Math.min(pctValue, 100)} className="h-1.5" />
                          </div>
                        </div>
                        <div className="text-right text-xs font-mono shrink-0">
                          {r.error && r.countUnknown ? (
                            <div className="text-destructive">—</div>
                          ) : (
                            <>
                              <div>
                                <span className="text-foreground">
                                  {r.countUnknown ? "—" : formatNum(r.stakedInFarm)}
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}/ {formatNum(r.circulatingSupply)} circulating
                                </span>{" "}
                                <span className="text-cheese">
                                  ({r.countUnknown ? "—" : formatPct(r.circulatingPct)})
                                </span>
                              </div>
                              <div className="text-muted-foreground">
                                {r.countUnknown ? "—" : formatNum(r.stakedInFarm)} /{" "}
                                {formatNum(r.issuedSupply)} issued ·{" "}
                                {formatNum(r.burnedSupply)} nulled ·{" "}
                                {r.maxSupply > 0 ? (
                                  <>
                                    {formatNum(r.maxSupply)} max{" "}
                                    <span>({r.countUnknown ? "—" : formatPct(r.maxPct)})</span>
                                  </>
                                ) : (
                                  <>uncapped max</>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}