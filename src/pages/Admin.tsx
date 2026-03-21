import { Layout } from '@/components/Layout';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useContractConfigs } from '@/hooks/useContractConfigs';
import { useFailedTransactions } from '@/hooks/useFailedTransactions';
import { ContractStatusCard } from '@/components/admin/ContractStatusCard';
import { PriceDeviationGauge } from '@/components/admin/PriceDeviationGauge';
import { FailedTransactionLog } from '@/components/admin/FailedTransactionLog';
import { AddBannerSlotsCard } from '@/components/admin/AddBannerSlotsCard';
import { parseAssetAmount, getDeviationSeverity } from '@/lib/adminData';
import { Flame, CurrencyCircleDollar, Megaphone, Lightning, ShieldCheck, ArrowsClockwise, BookOpenText } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Admin() {
  const { isWhitelisted, isLoading: accessLoading, isConnected } = useAdminAccess();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading: configsLoading } = useContractConfigs(isWhitelisted && autoRefresh);
  const { data: failedTxs, isLoading: txsLoading } = useFailedTransactions(isWhitelisted);

  // Access gate
  if (accessLoading) {
    return (
      <Layout>
        <div className="container py-12 flex items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </div>
      </Layout>
    );
  }

  if (!isConnected || !isWhitelisted) {
    return (
      <Layout>
        <div className="container py-20 text-center space-y-4">
          <ShieldCheck className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Not Authorized</h1>
          <p className="text-muted-foreground">
            {!isConnected
              ? 'Connect your wallet to access this page.'
              : 'Your account is not whitelisted for admin access.'}
          </p>
        </div>
      </Layout>
    );
  }

  // Derive overall statuses
  const burnerDisabled = data?.burnerConfig != null && !data.burnerConfig.enabled;
  const cheeseWaxSeverity = data?.deviations?.cheeseWax != null
    ? getDeviationSeverity(data.deviations.cheeseWax)
    : 'green';
  const waxdaoWaxSeverity = data?.deviations?.waxdaoWax != null
    ? getDeviationSeverity(data.deviations.waxdaoWax)
    : 'green';
  const feefeeStatus = cheeseWaxSeverity === 'red' || waxdaoWaxSeverity === 'red'
    ? 'critical' : cheeseWaxSeverity === 'yellow' || waxdaoWaxSeverity === 'yellow'
    ? 'warn' : 'ok';
  const bannadSeverity = data?.deviations?.bannadCheese != null
    ? getDeviationSeverity(data.deviations.bannadCheese)
    : 'green';

  return (
    <Layout>
      <div className="container py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CHEESE Contract Monitor</h1>
            <p className="text-sm text-muted-foreground">Admin-only dashboard • Live on-chain data</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/guide">
                <BookOpenText className="h-4 w-4 mr-1" />
                Ecosystem Guide
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground flex items-center gap-1">
                <ArrowsClockwise className="h-3.5 w-3.5" />
                Auto-refresh
              </Label>
            </div>
          </div>
        </div>

        {configsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : data ? (
          <>
            {/* Contract Cards Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* cheeseburner */}
              <ContractStatusCard
                title="cheeseburner"
                icon={<Flame className="h-5 w-5 text-red-400" />}
                status={burnerDisabled ? 'critical' : 'ok'}
                rows={[
                  {
                    label: 'Status',
                    value: data.burnerConfig == null
                      ? <Badge variant="outline">Config Unavailable</Badge>
                      : data.burnerConfig.enabled
                        ? <Badge className="bg-green-500/20 text-green-400">Enabled</Badge>
                        : <Badge className="bg-red-500/20 text-red-400">Disabled</Badge>,
                    critical: burnerDisabled,
                  },
                  { label: 'Min WAX to Burn', value: data.burnerConfig?.min_wax_to_burn ?? '—' },
                  { label: 'Pool ID', value: data.burnerConfig?.alcor_pool_id ?? '—' },
                  { label: 'Admin', value: data.burnerConfig?.admin ?? '—' },
                  { label: 'Total Burns', value: data.burnerStats?.total_burns?.toLocaleString() ?? '—' },
                  { label: 'WAX Claimed', value: data.burnerStats?.total_wax_claimed ?? '—' },
                  { label: 'CHEESE Burned', value: data.burnerStats?.total_cheese_burned ?? '—' },
                ]}
              />

              {/* cheesefeefee */}
              <ContractStatusCard
                title="cheesefeefee"
                icon={<CurrencyCircleDollar className="h-5 w-5 text-yellow-400" />}
                status={feefeeStatus as 'ok' | 'warn' | 'critical'}
                rows={[
                  { label: 'Max Deviation', value: '10% (hardcoded)' },
                ]}
              >
                <div className="space-y-3 mt-3">
                  <PriceDeviationGauge
                    label="WAX per CHEESE"
                    baseline={Number(data.feefeeConfig?.wax_per_cheese_baseline ?? 0)}
                    live={data.poolPrices.pool1252?.waxPerCheese ?? null}
                    deviationPct={data.deviations.cheeseWax}
                  />
                  <PriceDeviationGauge
                    label="WAXDAO per WAX"
                    baseline={Number(data.feefeeConfig?.waxdao_per_wax_baseline ?? 0)}
                    live={data.poolPrices.pool1236?.waxdaoPerWax ?? null}
                    deviationPct={data.deviations.waxdaoWax}
                  />
                </div>
              </ContractStatusCard>

              {/* cheesebannad */}
              <ContractStatusCard
                title="cheesebannad"
                icon={<Megaphone className="h-5 w-5 text-orange-400" />}
                status={bannadSeverity === 'red' ? 'critical' : bannadSeverity === 'yellow' ? 'warn' : 'ok'}
                rows={[
                  { label: 'Price/Day', value: data.bannadConfig?.wax_price_per_day ?? '—' },
                  { label: 'WAX/CHEESE Baseline', value: data.bannadConfig?.wax_per_cheese_baseline != null ? Number(data.bannadConfig.wax_per_cheese_baseline).toFixed(4) : '—' },
                  { label: 'Live WAX/CHEESE', value: data.poolPrices.pool1252?.waxPerCheese?.toFixed(4) ?? '—' },
                  {
                    label: 'Baseline Drift',
                    value: data.deviations.bannadCheese !== null
                      ? `${data.deviations.bannadCheese >= 0 ? '+' : ''}${data.deviations.bannadCheese.toFixed(2)}%`
                      : '—',
                    warn: bannadSeverity === 'yellow',
                    critical: bannadSeverity === 'red',
                  },
                  { label: 'Admins', value: data.bannadAdmins.length },
                ]}
              >
                {data.bannadAdmins.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Admin accounts: {data.bannadAdmins.map(a => a.account).join(', ')}
                    </p>
                  </div>
                )}
              </ContractStatusCard>

              {/* cheesepowerz */}
              <ContractStatusCard
                title="cheesepowerz"
                icon={<Lightning className="h-5 w-5 text-purple-400" />}
                status="ok"
                rows={[
                  { label: 'Total Powerups', value: data.powerzStats?.total_powerups?.toLocaleString() ?? '—' },
                  { label: 'WAX Spent', value: data.powerzStats?.total_wax_spent ?? '—' },
                  { label: 'CHEESE Received', value: data.powerzStats?.total_cheese_received ?? '—' },
                ]}
              />
            </div>

            {/* Add Banner Slots Tool */}
            <AddBannerSlotsCard />

            {/* Live Market Prices Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">WAX per CHEESE</p>
                <p className="text-lg font-bold text-foreground">{data.poolPrices.pool1252?.waxPerCheese?.toFixed(4) ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">CHEESE per WAX</p>
                <p className="text-lg font-bold text-foreground">{data.poolPrices.pool1252?.cheesePerWax?.toFixed(2) ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">WAXDAO per WAX</p>
                <p className="text-lg font-bold text-foreground">{data.poolPrices.pool1236?.waxdaoPerWax?.toFixed(2) ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">WAX per WAXDAO</p>
                <p className="text-lg font-bold text-foreground">{data.poolPrices.pool1236?.waxPerWaxdao?.toFixed(6) ?? '—'}</p>
              </div>
            </div>

            {/* Failed Transactions */}
            <FailedTransactionLog transactions={failedTxs ?? []} isLoading={txsLoading} />
          </>
        ) : null}
      </div>
    </Layout>
  );
}
