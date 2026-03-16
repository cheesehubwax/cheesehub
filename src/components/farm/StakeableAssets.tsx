import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2 } from "lucide-react";
import {
  fetchFarmStakableConfig,
  FarmStakableConfig,
  StakableTemplate,
  StakableSchema,
  StakableCollection,
  StakableAttribute,
  RewardRate,
} from "@/lib/farm";

interface StakeableAssetsProps {
  farmName: string;
  farmType: number;
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
      className="text-primary hover:text-primary/80 hover:underline text-xs font-mono whitespace-nowrap"
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
      className="text-primary hover:text-primary/80 hover:underline text-xs font-mono whitespace-nowrap"
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
      className="text-primary hover:text-primary/80 hover:underline text-xs font-mono whitespace-nowrap"
    >
      {c.collection} ({rates}/hr)
    </a>
  );
}

function AttributeChip({ a }: { a: StakableAttribute }) {
  const rates = formatRewardRates(a.hourly_rates, a.hourly_rate);

  return (
    <span className="text-primary text-xs font-mono whitespace-nowrap">
      {a.attribute_name}={a.attribute_value} ({rates}/hr)
    </span>
  );
}

export function StakeableAssets({ farmName, farmType }: StakeableAssetsProps) {
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
        {hasTemplates && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Templates:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.templates.map((t) => (
                <TemplateChip key={t.template_id} t={t} />
              ))}
            </div>
          </div>
        )}

        {hasSchemas && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Schemas:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.schemas.map((s) => (
                <SchemaChip key={`${s.collection}-${s.schema}`} s={s} />
              ))}
            </div>
          </div>
        )}

        {hasCollections && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Collections:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.collections.map((c) => (
                <CollectionChip key={c.collection} c={c} />
              ))}
            </div>
          </div>
        )}

        {hasAttributes && (
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Attributes:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {config.attributes.map((a) => (
                <AttributeChip key={`${a.attribute_name}-${a.attribute_value}`} a={a} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
