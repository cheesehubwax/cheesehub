import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useFarmCapacity } from "@/hooks/useFarmCapacity";
import { checkFarmCapacity, type CapacityRule } from "@/lib/farmCapacity";
import { Settings2 } from "lucide-react";
import {
  fetchFarmStakableConfig,
  FarmStakableConfig,
  StakableTemplate,
  StakableSchema,
  StakableCollection,
  StakableAttribute,
  RewardRate,
  FarmInfo,
} from "@/lib/farm";

interface StakeableAssetsProps {
  farmName: string;
  farmType: number;
  farm: FarmInfo;
}

function formatRewardRates(hourlyRates?: RewardRate[], hourlyRate?: string): string {
  if (hourlyRates && hourlyRates.length > 0) {
    return hourlyRates
      .map((r) => {
        const parts = r.quantity.split(" ");
        const amount = parts[0] || "0";
        const symbol = parts[1] || "";
        return `${amount} ${symbol}`;
      })
      .join(" + ");
  }
  if (hourlyRate && hourlyRate !== "0") {
    return hourlyRate;
  }
  return "0";
}

function TemplateChip({ t }: { t: StakableTemplate }) {
  const rates = formatRewardRates(t.hourly_rates, t.hourly_rate);
  const url = `https://atomichub.io/explorer/template/wax-mainnet/${t.collection}/${t.template_id}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:text-primary/80 hover:underline text-xs font-mono break-all"
    >
      #{t.template_id} ({rates}/hr)
    </a>
  );
}

function SchemaChip({ s }: { s: StakableSchema }) {
  const rates = formatRewardRates(s.hourly_rates, s.hourly_rate);
  const url = `https://atomichub.io/explorer/schema/wax-mainnet/${s.collection}/${s.schema}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:text-primary/80 hover:underline text-xs font-mono break-all"
    >
      {s.collection}/{s.schema} ({rates}/hr)
    </a>
  );
}

function CollectionChip({ c }: { c: StakableCollection }) {
  const rates = formatRewardRates(c.hourly_rates, c.hourly_rate);
  const url = `https://atomichub.io/explorer/collection/wax-mainnet/${c.collection}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:text-primary/80 hover:underline text-xs font-mono break-all"
    >
      {c.collection} ({rates}/hr)
    </a>
  );
}

function AttributeChip({ a }: { a: StakableAttribute }) {
  const rates = formatRewardRates(a.hourly_rates, a.hourly_rate);

  return (
    <span className="text-primary text-xs font-mono break-all">
      {a.attribute_name}={a.attribute_value} ({rates}/hr)
    </span>
  );
}

export function StakeableAssets({ farmName, farmType, farm }: StakeableAssetsProps) {
  const { summary, now } = useFarmCapacity(farm);
  const capacityBadge = (rule: CapacityRule) => {
    const state = checkFarmCapacity(farm, [rule], now);
    if (state === 'inactive') return null;
    return <Badge variant="outline" className={state === 'blocked' ? 'text-primary border-primary/40' : 'text-muted-foreground'}>
      {state === 'blocked' ? 'At capacity' : state === 'available' ? 'Fits 1 NFT now' : 'Capacity unverified'}
    </Badge>;
  };
  const { data: config, isLoading } = useQuery({
    queryKey: ["farmStakableConfig", farmName],
    queryFn: () => fetchFarmStakableConfig(farmName),
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!config) return null;

  const hasTemplates = config.templates.length > 0;
  const hasSchemas = config.schemas.length > 0;
  const hasCollections = config.collections.length > 0;
  const hasAttributes = config.attributes.length > 0;
  const hasAny = hasTemplates || hasSchemas || hasCollections || hasAttributes;

  if (!hasAny) return null;

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Stakeable Assets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(summary === 'limited' || summary === 'full') && (
          <p role="status" className="text-sm text-primary">
            <strong>{summary === 'full' ? 'Farm full.' : 'Limited capacity.'}</strong>{' '}
            {summary === 'full' ? 'No configured NFT reward rate fits the remaining rewards.' : 'Some NFT reward rates exceed the remaining rewards, while others still fit.'}{' '}
            Check the label beside each rate before buying an NFT. Capacity can change as others stake, leave or add rewards.
          </p>
        )}
        {hasTemplates && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Templates:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.templates.map((t) => (
                <span key={t.template_id} className="inline-flex flex-wrap items-center gap-1.5 min-w-0"><TemplateChip t={t} />{farmType === 2 && capacityBadge(t)}</span>
              ))}
            </div>
          </div>
        )}

        {hasSchemas && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Schemas:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.schemas.map((s) => (
                <span key={`${s.collection}-${s.schema}`} className="inline-flex flex-wrap items-center gap-1.5 min-w-0"><SchemaChip s={s} />{farmType === 1 && capacityBadge(s)}</span>
              ))}
            </div>
          </div>
        )}

        {hasCollections && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Collections:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.collections.map((c) => (
                <span key={c.collection} className="inline-flex flex-wrap items-center gap-1.5 min-w-0"><CollectionChip c={c} />{farmType === 0 && capacityBadge(c)}</span>
              ))}
            </div>
          </div>
        )}

        {hasAttributes && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Attributes:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.attributes.map((a) => (
                <span key={`${a.attribute_name}-${a.attribute_value}`} className="inline-flex flex-wrap items-center gap-1.5 min-w-0"><AttributeChip a={a} />{farmType === 3 && capacityBadge(a)}</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
