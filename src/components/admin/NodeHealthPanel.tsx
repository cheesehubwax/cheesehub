// Read-only view of the node health CHEESEHub is currently reading from.
// Source: HerdCheck (https://herdcheck.blocdraig.com) — no writes, no signing.
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  fetchEndpointHealth,
  STATIC_ENDPOINTS,
  mergeEndpoints,
  normalizeEndpoint,
  type EndpointFeature,
  type HealthEntry,
} from '@/lib/endpointHealth';

const FEATURES: { key: EndpointFeature; label: string }[] = [
  { key: 'chain-api', label: 'Chain reads' },
  { key: 'hyperion-v2', label: 'History (Hyperion)' },
  { key: 'atomic-assets-api', label: 'NFT API' },
];

interface FeatureHealth {
  feature: EndpointFeature;
  label: string;
  entries: HealthEntry[];
  /** The order our readers will actually use. */
  order: string[];
}

async function loadHealth(): Promise<FeatureHealth[]> {
  return Promise.all(
    FEATURES.map(async ({ key, label }) => {
      const entries = await fetchEndpointHealth(key).catch(() => [] as HealthEntry[]);
      return { feature: key, label, entries, order: mergeEndpoints(entries, STATIC_ENDPOINTS[key]) };
    }),
  );
}

const host = (url: string) => normalizeEndpoint(url).replace(/^https?:\/\//, '');

export function NodeHealthPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'node-health'],
    queryFn: loadHealth,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  return (
    <Card className="border border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">🩺 Node health</span>
          <Badge className="bg-primary/20 text-primary">Read-only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Live endpoint health from{' '}
          <a
            href="https://herdcheck.blocdraig.com/wax/lists?status=up"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            HerdCheck
          </a>
          . Reads are queued in the order shown; a node that is down is skipped entirely.
        </p>

        {isLoading && <p className="text-muted-foreground">Checking nodes…</p>}
        {isError && (
          <p className="text-yellow-400">
            Health could not be read — CHEESEHub is using its built-in node order.
          </p>
        )}

        {data?.map((group) => (
          <div key={group.feature} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{group.label}</span>
              <span className="text-xs text-muted-foreground">
                {group.entries.length > 0
                  ? `${group.entries.length} healthy`
                  : 'using built-in order'}
              </span>
            </div>
            <ol className="space-y-1">
              {group.order.map((url, i) => {
                const entry = group.entries.find((e) => e.url === normalizeEndpoint(url));
                return (
                  <li key={url} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {i + 1}. {host(url)}
                    </span>
                    {entry ? (
                      <span
                        className={
                          entry.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'
                        }
                      >
                        {entry.status} · {entry.uptimePercent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">fallback</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
