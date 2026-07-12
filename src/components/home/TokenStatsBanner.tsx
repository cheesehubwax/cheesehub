import { useCheeseStats } from '@/hooks/useCheeseStats';
import { useNullBreakdown } from '@/hooks/useNullBreakdown';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExternalLink } from 'lucide-react';
import { CHEESE_CONFIG } from '@/lib/waxConfig';
import cheeseLogo from '@/assets/cheese-logo.png';

// Format large numbers with abbreviations
function formatLargeNumber(num: number, decimals: number = 1): string {
  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(decimals)}T`;
  }
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`;
  }
  return num.toLocaleString();
}

// Format with full number for tooltip
function formatFullNumber(num: number): string {
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function TokenStatsBanner() {
  const { data: stats, isLoading, isError } = useCheeseStats();
  const { data: breakdown, isLoading: breakdownLoading, refetch: fetchBreakdown } = useNullBreakdown();

  return (
    <section className="container py-8">
      <Card className="bg-gradient-to-r from-cheese/5 via-background to-cheese/5 border-cheese/30 backdrop-blur-sm overflow-hidden relative">
        {/* Subtle animated glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cheese/5 to-transparent animate-pulse" />

        <div className="relative p-6">
          {/* Top row - 5 columns */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Total and Max Supply */}
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <div className="h-12 w-12 rounded-full bg-cheese/20 flex items-center justify-center shrink-0">
                <img src={cheeseLogo} alt="CHEESE" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total and Max Supply</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p
                      className="text-xl font-bold text-foreground"
                      title={`${formatFullNumber(stats?.maxSupply ?? 0)} CHEESE`}
                    >
                      {formatLargeNumber(stats?.maxSupply ?? 0)} <span className="text-cheese">CHEESE</span>
                    </p>
                    <a
                      href="https://waxblock.io/account/cheeseburger?code=cheeseburger&scope=CHEESE&table=stat&lower_bound=&upper_bound=&limit=10&reverse=false#contract-tables"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cheese/70 hover:text-foreground underline transition-colors"
                    >
                      proof
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Locked Supply */}
            <div className="flex items-center gap-4 justify-center">
              <div className="h-12 w-12 rounded-full bg-cheese/20 flex items-center justify-center shrink-0">
                <OpenMojiIcon emoji="🔒" size={24} className="text-2xl" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Locked Supply</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-28 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p
                      className="text-xl font-bold text-foreground"
                      title={`${formatFullNumber(stats?.lockedSupply ?? 0)} CHEESE`}
                    >
                      {formatFullNumber(stats?.lockedSupply ?? 0)} <span className="text-cheese">CHEESE</span>
                    </p>
                    <a
                      href="https://waxblock.io/account/waxdaolocker?code=waxdaolocker&scope=waxdaolocker&table=locks&lower_bound=249&upper_bound=259&limit=10&reverse=false#contract-tables"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cheese/70 hover:text-foreground underline transition-colors"
                    >
                      proof
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Circulating Supply */}
            <div className="flex items-center gap-4 justify-center">
              <div className="h-12 w-12 rounded-full bg-cheese/20 flex items-center justify-center shrink-0">
                <OpenMojiIcon emoji="🔄" size={24} className="text-2xl" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Circulating Supply</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-28 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : (
                  <p
                    className="text-xl font-bold text-foreground"
                    title={`${formatFullNumber((stats?.totalSupply ?? 0) - (stats?.lockedSupply ?? 0) - (stats?.nulledBalance ?? 0))} CHEESE`}
                  >
                    {formatFullNumber((stats?.totalSupply ?? 0) - (stats?.lockedSupply ?? 0) - (stats?.nulledBalance ?? 0))} <span className="text-cheese">CHEESE</span>
                  </p>
                )}
              </div>
            </div>

            {/* Next Unlock */}
            <div className="flex items-center gap-4 justify-center">
              <div className="h-12 w-12 rounded-full bg-cheese/20 flex items-center justify-center shrink-0">
                <OpenMojiIcon emoji="⏳" size={24} className="text-2xl" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Next Unlock</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : stats?.nextUnlock ? (
                  <div className="flex flex-col gap-1">
                    <p
                      className="text-xl font-bold text-foreground"
                      title={`${formatFullNumber(stats.nextUnlock.amount)} CHEESE unlocking in ${stats.nextUnlock.year}`}
                    >
                      {stats.nextUnlock.year} <span className="text-cheese">({formatLargeNumber(stats.nextUnlock.amount, 2)})</span>
                    </p>
                    <a
                      href="https://waxblock.io/account/waxdaolocker?code=waxdaolocker&scope=waxdaolocker&table=locks&lower_bound=249&upper_bound=259&limit=10&reverse=false#contract-tables"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cheese/70 hover:text-foreground underline transition-colors"
                    >
                      proof
                    </a>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-muted-foreground">None</p>
                )}
              </div>
            </div>

            {/* CHEESE Nulled */}
            <Popover onOpenChange={(open) => { if (open) fetchBreakdown(); }}>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-4 justify-center md:justify-end cursor-pointer group">
                  <div className="h-12 w-12 rounded-full bg-cheese/20 flex items-center justify-center shrink-0">
                    <OpenMojiIcon emoji="⛔" size={24} className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium group-hover:text-cheese transition-colors">CHEESE Nulled ▾</p>
                    {isLoading ? (
                      <Skeleton className="h-7 w-24 mt-1" />
                    ) : isError ? (
                      <p className="text-lg font-bold text-destructive">Error</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p
                          className="text-xl font-bold text-foreground group-hover:text-cheese transition-colors"
                          title={`${formatFullNumber(stats?.nulledBalance ?? 0)} CHEESE sent to eosio.null`}
                        >
                          {formatFullNumber(stats?.nulledBalance ?? 0)} <span className="text-cheese">CHEESE</span>
                        </p>
                        <a
                          href="https://waxblock.io/account/eosio.null?code=cheeseburger&scope=eosio.null&table=accounts&lower_bound=&upper_bound=&limit=10&reverse=false#contract-tables"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cheese/70 hover:text-foreground underline transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          proof
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[860px] max-w-[860px] p-0" align="end">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">Null Breakdown by Contract</p>
                </div>
                {breakdownLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : breakdown && breakdown.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs whitespace-nowrap">Contract</TableHead>
                         <TableHead className="h-8 text-xs text-right whitespace-nowrap">24h</TableHead>
                         <TableHead className="h-8 text-xs text-right w-16 whitespace-nowrap">24h %</TableHead>
                         <TableHead className="h-8 text-xs text-right whitespace-nowrap">7d</TableHead>
                         <TableHead className="h-8 text-xs text-right w-16 whitespace-nowrap">7d %</TableHead>
                         <TableHead className="h-8 text-xs text-right whitespace-nowrap">30d</TableHead>
                         <TableHead className="h-8 text-xs text-right w-16 whitespace-nowrap">30d %</TableHead>
                         <TableHead className="h-8 text-xs text-right whitespace-nowrap">Total</TableHead>
                         <TableHead className="h-8 text-xs text-right w-16">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((entry) => (
                        <TableRow key={entry.contract}>
                          <TableCell className="py-2 text-xs font-mono whitespace-nowrap">{entry.displayName ?? entry.contract}</TableCell>
                          <TableCell className="py-2 text-xs text-right">
                            {formatFullNumber(entry.amount24h)} <span className="text-cheese">CHEESE</span>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right font-semibold">
                            {entry.percent24h.toFixed(1)}%
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right">
                            {formatFullNumber(entry.amount7d)} <span className="text-cheese">CHEESE</span>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right font-semibold">
                            {entry.percent7d.toFixed(1)}%
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right">
                            {formatFullNumber(entry.amount30d)} <span className="text-cheese">CHEESE</span>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right font-semibold">
                            {entry.percent30d.toFixed(1)}%
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right">
                            {formatFullNumber(entry.amount)} <span className="text-cheese">CHEESE</span>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right font-semibold">
                            {entry.percent.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No data available
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Bottom row - Contract Status centered */}
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <span className="text-2xl">🛡️</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Contract Status</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={stats?.isNulled
                          ? "border-green-500/50 bg-green-500/10 text-green-500 font-semibold"
                          : "border-yellow-500/50 bg-yellow-500/10 text-yellow-500 font-semibold"
                        }
                      >
                        🔒 {stats?.status}
                      </Badge>
                      {stats?.isNulled && (
                        <span className="text-xs text-muted-foreground">(Nulled Keys)</span>
                      )}
                    </div>
                    {stats?.isNulled && (
                      <a
                        href="https://waxblock.io/account/cheeseburger#keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cheese/70 hover:text-foreground underline transition-colors"
                      >
                        proof
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contract link */}
          <div className="mt-4 pt-4 border-t border-border/50 flex justify-center">
            <a
              href={`https://waxblock.io/account/${CHEESE_CONFIG.tokenContract}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-cheese transition-colors flex items-center gap-1"
            >
              View {CHEESE_CONFIG.tokenContract} contract on WaxBlock
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>
    </section>
  );
}
