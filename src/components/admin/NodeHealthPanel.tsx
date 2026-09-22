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
  benchedEndpoints,
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

interface HealthReport {
  groups: FeatureHealth[];
  /** Hosts this browser could not reach just now, and when they come back. */
  benched: { url: string; until: number }[];
}

async function loadHealth(): Promise<HealthReport> {
  const groups = await Promise.all(
    FEATURES.map(async ({ key, label }) => {
      const entries = await fetchEndpointHealth(key).catch(() => [] as HealthEntry[]);
      return { feature: key, label, entries, order: mergeEndpoints(entries, STATIC_ENDPOINTS[key]) };
    }),
  );
  return { groups, benched: benchedEndpoints() };
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

        {data && data.benched.length > 0 && (
          <div className="rounded-md border border-yellow-400/40 bg-yellow-400/5 p-2">
            <p className="font-semibold text-yellow-400">Not answering this browser</p>
            <ul className="mt-1 space-y-1">
              {data.benched.map(({ url, until }) => (
                <li key={url} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{host(url)}</span>
                  <span className="text-xs text-muted-foreground">
                    retried in {Math.max(0, Math.round((until - Date.now()) / 1000))}s
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">
              A node can be healthy for the monitor and still be unreachable from a visitor's
              connection. Those are tried last until they answer again.
            </p>
          </div>
        )}

        {data?.groups.map((group) => (
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
