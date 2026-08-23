import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { waxRpcCall } from '@/lib/waxRpcFallback';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { RefreshCw, Loader2 } from 'lucide-react';


/** eosio::refunds row, also returned inline by get_account as `refund_request`. */
export interface RefundRequest {
  owner: string;
  request_time: string;
  net_amount: string;
  cpu_amount: string;
}

export interface AccountResources {
  ram_quota: number;
  ram_usage: number;
  cpu_limit: { used: number; max: number };
  net_limit: { used: number; max: number };
  core_liquid_balance?: string;
  cpu_weight?: string;
  net_weight?: string;
  self_delegated_bandwidth?: { cpu_weight: string; net_weight: string };
  total_resources?: { cpu_weight: string; net_weight: string };
  refund_request?: RefundRequest | null;
  created?: string;
  creator?: string;
}

export const REFUND_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

export interface RefundStatus {
  /** Total WAX pending (cpu + net). */
  amount: number;
  /** True once the 3-day refund delay has elapsed. */
  available: boolean;
  /** Human-readable time remaining, e.g. "2d 4h" / "4h 12m". Empty when available. */
  timeLeft: string;
}

/**
 * Shared 3-day refund maturity calculation. Used by both the account summary
 * and the Stake manager's Refund tab so the two views can never disagree.
 */
export function getRefundStatus(
  refund: RefundRequest | null | undefined,
  now: number = Date.now()
): RefundStatus | null {
  if (!refund) return null;
  const cpu = parseFloat(refund.cpu_amount?.split(' ')[0] || '0') || 0;
  const net = parseFloat(refund.net_amount?.split(' ')[0] || '0') || 0;
  const amount = cpu + net;
  if (amount <= 0) return null;

  const raw = refund.request_time || '';
  const requestTime = new Date(raw.endsWith('Z') ? raw : `${raw}Z`).getTime();
  const readyAt = requestTime + REFUND_DELAY_MS;

  if (!Number.isFinite(requestTime)) return { amount, available: true, timeLeft: '' };
  if (now >= readyAt) return { amount, available: true, timeLeft: '' };

  const remaining = readyAt - now;
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const timeLeft = days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
  return { amount, available: false, timeLeft };
}


export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCpu(us: number): string {
  if (us < 1000) return `${us} µs`;
  if (us < 1000000) return `${(us / 1000).toFixed(2)} ms`;
  return `${(us / 1000000).toFixed(2)} s`;
}

export function parseWaxBalance(balance: string | undefined): number {
  if (!balance) return 0;
  return parseFloat(balance.replace(' WAX', '')) || 0;
}

export function parseStakedWeight(weight: string | number | undefined): number {
  if (!weight) return 0;
  if (typeof weight === 'string') {
    if (weight.includes(' WAX')) return parseFloat(weight.replace(' WAX', ''));
    return Number(weight) / 100000000;
  }
  return Number(weight) / 100000000;
}

interface WalletResourcesProps {
  onResourcesUpdate?: (resources: AccountResources | null) => void;
  showTotalWaxBalance?: boolean;
  waxUsdPrice?: number;
}

export function WalletResources({ onResourcesUpdate, showTotalWaxBalance, waxUsdPrice = 0 }: WalletResourcesProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [resources, setResources] = useState<AccountResources | null>(null);
  const [ramPrice, setRamPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  // Coarse ticker: day/hour countdown needs no per-second updates.
  const [now, setNow] = useState(() => Date.now());



  const fetchRamPrice = async () => {
    try {
      const data = await waxRpcCall<{ rows: Array<{ quote: { balance: string }; base: { balance: string } }> }>('/v1/chain/get_table_rows', { code: 'eosio', scope: 'eosio', table: 'rammarket', limit: 1, json: true });
      if (data.rows?.[0]) {
        const quoteBalance = parseFloat(data.rows[0].quote.balance.replace(' WAX', ''));
        const baseBalance = parseFloat(data.rows[0].base.balance.replace(' RAM', ''));
        setRamPrice(quoteBalance / baseBalance);
      }
    } catch (error) { console.error('Failed to fetch RAM price:', error); }
  };

  const fetchResources = async () => {
    if (!accountName) return;
    setIsLoading(true);
    try {
      const data = await waxRpcCall<AccountResources & Record<string, unknown> & { created?: string }>('/v1/chain/get_account', { account_name: accountName });
      // get_account returns 'created' directly (ISO timestamp)
      let created: string | undefined = data.created as string | undefined;
      let creator: string | undefined;
      // Try multiple Hyperion endpoints for creator info
      const hyperionEndpoints = [
        'https://wax.eosusa.io',
        'https://api.wax.alohaeos.com',
        'https://wax.eosphere.io',
      ];
      for (const ep of hyperionEndpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const creationRes = await fetch(`${ep}/v2/history/get_creator?account=${accountName}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (creationRes.ok) {
            const d = await creationRes.json();
            if (d.creator) { creator = d.creator; }
            if (d.timestamp && !created) { created = d.timestamp; }
            break;
          }
        } catch { /* try next endpoint */ }
      }

      const newResources: AccountResources = {
        ram_quota: data.ram_quota || 0, ram_usage: data.ram_usage || 0,
        cpu_limit: data.cpu_limit || { used: 0, max: 0 }, net_limit: data.net_limit || { used: 0, max: 0 },
        core_liquid_balance: data.core_liquid_balance, cpu_weight: data.cpu_weight as string | undefined, net_weight: data.net_weight as string | undefined,
        self_delegated_bandwidth: data.self_delegated_bandwidth as AccountResources['self_delegated_bandwidth'],
        total_resources: data.total_resources as AccountResources['total_resources'],
        refund_request: (data.refund_request as RefundRequest | null | undefined) ?? null,
        created, creator,
      };
      setResources(newResources);
      onResourcesUpdate?.(newResources);

    } catch (error) { console.error('Failed to fetch resources:', error); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (accountName) { fetchResources(); fetchRamPrice(); } }, [accountName]);

  // Keep the refund countdown fresh without a per-second timer.
  useEffect(() => {
    if (!resources?.refund_request) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [resources?.refund_request]);

  const waxBalance = parseWaxBalance(resources?.core_liquid_balance);
  const ramUsagePercent = resources ? Math.round((resources.ram_usage / resources.ram_quota) * 100) : 0;
  const cpuPercent = resources ? Math.min(100, Math.round((resources.cpu_limit.used / resources.cpu_limit.max) * 100)) : 0;
  const netPercent = resources ? Math.min(100, Math.round((resources.net_limit.used / resources.net_limit.max) * 100)) : 0;
  const ramWaxValue = resources && ramPrice ? (resources.ram_quota * ramPrice) : null;
  const selfCpuStaked = parseStakedWeight(resources?.self_delegated_bandwidth?.cpu_weight);
  const selfNetStaked = parseStakedWeight(resources?.self_delegated_bandwidth?.net_weight);
  const refundStatus = getRefundStatus(resources?.refund_request, now);
  const unstakingBalance = refundStatus?.amount ?? 0;
  const totalWaxBalance = waxBalance + selfCpuStaked + selfNetStaked + unstakingBalance;
  const totalWaxUsd = totalWaxBalance * waxUsdPrice;
  const stakedBalance = selfCpuStaked + selfNetStaked;

  const handleClaimRefund = async () => {
    if (!accountName || isClaiming) return;
    setIsClaiming(true);
    const amount = refundStatus?.amount ?? 0;
    const result = await executeTransaction(
      [{ account: 'eosio', name: 'refund', authorization: [session!.permissionLevel], data: { owner: accountName } }],
      { successTitle: 'Refund Claimed!', successDescription: `Refunded ${amount.toFixed(8)} WAX to your liquid balance.` }
    );
    setIsClaiming(false);
    if (result.success) await fetchResources();
  };


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 items-center p-3 bg-muted/50 rounded-lg">
        <div className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Account: </span><span className="font-medium text-foreground">{accountName}</span></div>
          <div><span className="text-muted-foreground">Liquid: </span><span className="font-medium text-cheese">{waxBalance.toFixed(8)} WAX</span></div>
        </div>
        <div className="text-sm text-center space-y-1">
          <div>
            <span className="text-muted-foreground">Staked: </span>
            <span className="font-medium text-cheese">{stakedBalance.toFixed(8)} WAX</span>
          </div>
          {refundStatus ? (
            <div className="flex items-center justify-center gap-2">
              {refundStatus.available ? (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-green-500 font-medium">Refund Ready:</span>
                  <span className="font-semibold text-green-500">{refundStatus.amount.toFixed(8)} WAX</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Unstaking: </span>
                  <span className="font-medium text-amber-500">{refundStatus.amount.toFixed(8)} WAX</span>
                  <span className="text-muted-foreground">— ready in {refundStatus.timeLeft}</span>
                </>
              )}
              <Button
                size="sm"
                onClick={handleClaimRefund}
                disabled={!refundStatus.available || isClaiming}
                title={refundStatus.available ? 'Claim your refund' : `Claimable in ${refundStatus.timeLeft}`}
                className={`h-6 px-2 text-[11px] ${refundStatus.available
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-amber-500/20 text-amber-500/70 border border-amber-500/30 opacity-60 cursor-not-allowed hover:bg-amber-500/20'}`}
              >
                {isClaiming ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Claim'}
              </Button>
            </div>
          ) : (
            <div className="invisible h-5" />
          )}
        </div>


        <div className="flex items-center gap-3 justify-self-end">
          {showTotalWaxBalance && resources && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total WAX Balance</div>
              <div className="text-lg font-semibold text-cheese">{totalWaxBalance.toFixed(4)} WAX</div>
              {waxUsdPrice > 0 && <div className="text-xs text-muted-foreground">${totalWaxUsd.toFixed(2)} USD</div>}
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={fetchResources} disabled={isLoading} className="h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      {resources && (
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          {[
            { percent: cpuPercent, label: 'CPU', color: 'text-green-500', staked: selfCpuStaked, formatFn: formatCpu, limit: resources.cpu_limit },
            { percent: netPercent, label: 'NET', color: 'text-blue-500', staked: selfNetStaked, formatFn: formatBytes, limit: resources.net_limit },
          ].map(({ percent, label, color, staked, formatFn, limit }) => (
            <div key={label} className="space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${percent * 1.26} 126`} className={color} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-medium text-xs">{percent}%</span>
              </div>
              <div className="text-muted-foreground">{label}</div>
              <div>{formatFn(limit.used)} / {formatFn(limit.max)}</div>
              <div className={`${color} text-[10px]`}>{staked.toFixed(4)} WAX staked</div>
            </div>
          ))}
          <div className="space-y-1">
            <div className="relative w-12 h-12 mx-auto">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${ramUsagePercent * 1.26} 126`} className="text-cheese" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-medium">{ramUsagePercent}%</span>
            </div>
            <div className="text-muted-foreground">RAM</div>
            <div>{formatBytes(resources.ram_usage)} / {formatBytes(resources.ram_quota)}</div>
            <div className="text-cheese text-[10px]">{ramWaxValue !== null ? `${ramWaxValue.toFixed(4)} WAX` : '...'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AccountDetailsSection({ resources }: { resources: AccountResources | null }) {
  if (!resources) return null;
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Unknown';
    try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return dateStr; }
  };
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Account Details</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-muted/30 space-y-1"><div className="text-muted-foreground text-xs">Date Created</div><div className="font-medium">{formatDate(resources.created)}</div></div>
        <div className="p-3 rounded-lg bg-muted/30 space-y-1"><div className="text-muted-foreground text-xs">Creator Account</div><div className="font-medium text-cheese">{resources.creator || 'Unknown'}</div></div>
      </div>
    </div>
  );
}

export function StakedResourcesSection({ resources }: { resources: AccountResources | null }) {
  if (!resources) return null;
  const selfCpuStaked = parseStakedWeight(resources.self_delegated_bandwidth?.cpu_weight);
  const selfNetStaked = parseStakedWeight(resources.self_delegated_bandwidth?.net_weight);
  const totalCpuWeight = parseStakedWeight(resources.total_resources?.cpu_weight);
  const totalNetWeight = parseStakedWeight(resources.total_resources?.net_weight);
  const cpuStakedByOthers = Math.max(0, totalCpuWeight - selfCpuStaked);
  const netStakedByOthers = Math.max(0, totalNetWeight - selfNetStaked);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Staked Resources</h3>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-muted/30 space-y-1"><div className="text-muted-foreground text-xs">CPU Stake</div><div className="font-medium text-green-500">{selfCpuStaked.toFixed(4)} WAX</div></div>
        <div className="p-3 rounded-lg bg-muted/30 space-y-1"><div className="text-muted-foreground text-xs">NET Stake</div><div className="font-medium text-blue-500">{selfNetStaked.toFixed(4)} WAX</div></div>
        <div className="p-3 rounded-lg bg-muted/30 space-y-1"><div className="text-muted-foreground text-xs">Staked by Others</div><div className="font-medium text-purple-400">{(cpuStakedByOthers + netStakedByOthers).toFixed(4)} WAX</div><div className="text-[10px] text-muted-foreground">CPU: {cpuStakedByOthers.toFixed(2)} / NET: {netStakedByOthers.toFixed(2)}</div></div>
      </div>
    </div>
  );
}
