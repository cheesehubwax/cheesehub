import { useCallback, useEffect, useState } from 'react';
import { useWax } from '@/context/WaxContext';
import { waxRpcCall } from '@/lib/waxRpcFallback';
import { formatBytes, parseStakedWeight, type AccountResources } from '@/components/wallet/WalletResources';

/** Window event name used to tell every mounted ResourceGauges to re-fetch. */
export const RESOURCE_GAUGES_REFRESH_EVENT = 'cheese:refresh-resource-gauges';

/** Ask all mounted resource gauges to reload from the chain. */
export function refreshResourceGauges() {
  window.dispatchEvent(new Event(RESOURCE_GAUGES_REFRESH_EVENT));
}

function formatCpu(us: number): string {
  if (us < 1000) return `${us} µs`;
  if (us < 1000000) return `${(us / 1000).toFixed(2)} ms`;
  return `${(us / 1000000).toFixed(2)} s`;
}

interface GaugeProps {
  percent: number;
  label: string;
  color: string;
  used: string;
  max: string;
  sub: string;
}

const Gauge = ({ percent, label, color, used, max, sub }: GaugeProps) => (
  <div className="space-y-1">
    <div className="relative w-12 h-12 mx-auto">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${percent * 1.26} 126`} className={color} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-medium text-xs">{percent}%</span>
    </div>
    <div className="text-muted-foreground">{label}</div>
    <div>{used} / {max}</div>
    <div className={`${color} text-[10px]`}>{sub}</div>
  </div>
);

/**
 * The three circular resource gauges (CPU / NET / RAM) from CHEESEWallet,
 * reusable on other pages. Renders nothing when no wallet is connected.
 */
export function ResourceGauges() {
  const { accountName } = useWax();
  const [resources, setResources] = useState<AccountResources | null>(null);
  const [ramPrice, setRamPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!accountName) {
      setResources(null);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const data = await waxRpcCall<AccountResources>('/v1/chain/get_account', { account_name: accountName });
        if (cancelled) return;
        setResources({
          ram_quota: data.ram_quota || 0,
          ram_usage: data.ram_usage || 0,
          cpu_limit: data.cpu_limit || { used: 0, max: 0 },
          net_limit: data.net_limit || { used: 0, max: 0 },
          self_delegated_bandwidth: data.self_delegated_bandwidth,
        });
      } catch (error) {
        console.error('Failed to fetch resources:', error);
      }
      try {
        const data = await waxRpcCall<{ rows: Array<{ quote: { balance: string }; base: { balance: string } }> }>(
          '/v1/chain/get_table_rows',
          { code: 'eosio', scope: 'eosio', table: 'rammarket', limit: 1, json: true }
        );
        if (cancelled) return;
        if (data.rows?.[0]) {
          const quote = parseFloat(data.rows[0].quote.balance.replace(' WAX', ''));
          const base = parseFloat(data.rows[0].base.balance.replace(' RAM', ''));
          setRamPrice(quote / base);
        }
      } catch (error) {
        console.error('Failed to fetch RAM price:', error);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [accountName]);

  if (!accountName || !resources) return null;

  const cpuPercent = resources.cpu_limit.max > 0 ? Math.min(100, Math.round((resources.cpu_limit.used / resources.cpu_limit.max) * 100)) : 0;
  const netPercent = resources.net_limit.max > 0 ? Math.min(100, Math.round((resources.net_limit.used / resources.net_limit.max) * 100)) : 0;
  const ramPercent = resources.ram_quota > 0 ? Math.round((resources.ram_usage / resources.ram_quota) * 100) : 0;
  const selfCpuStaked = parseStakedWeight(resources.self_delegated_bandwidth?.cpu_weight);
  const selfNetStaked = parseStakedWeight(resources.self_delegated_bandwidth?.net_weight);
  const ramWaxValue = ramPrice !== null ? resources.ram_quota * ramPrice : null;

  return (
    <div className="grid grid-cols-3 gap-3 text-center text-xs max-w-md w-full">
      <Gauge
        percent={cpuPercent}
        label="CPU"
        color="text-green-500"
        used={formatCpu(resources.cpu_limit.used)}
        max={formatCpu(resources.cpu_limit.max)}
        sub={`${selfCpuStaked.toFixed(4)} WAX staked`}
      />
      <Gauge
        percent={netPercent}
        label="NET"
        color="text-blue-500"
        used={formatBytes(resources.net_limit.used)}
        max={formatBytes(resources.net_limit.max)}
        sub={`${selfNetStaked.toFixed(4)} WAX staked`}
      />
      <Gauge
        percent={ramPercent}
        label="RAM"
        color="text-cheese"
        used={formatBytes(resources.ram_usage)}
        max={formatBytes(resources.ram_quota)}
        sub={ramWaxValue !== null ? `${ramWaxValue.toFixed(4)} WAX` : '...'}
      />
    </div>
  );
}
