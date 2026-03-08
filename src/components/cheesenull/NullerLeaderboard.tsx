import { useState, useMemo } from 'react';
import { Flame, Zap, Trophy, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { type NullerStats, type SortMode, type LogburnAction, aggregateNullerStats } from '@/lib/fetchLeaderboard';
import { formatCheeseAmount } from '@/lib/cheeseNullApi';

interface NullerLeaderboardProps {
  rawActions: LogburnAction[];
  isLoading: boolean;
  isError: boolean;
  onRefresh?: () => void;
}

const SORT_OPTIONS: { mode: SortMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'cheese', label: 'CHEESE Nulled', icon: <Flame className="w-3.5 h-3.5" /> },
  { mode: 'burns', label: 'Burns', icon: <Zap className="w-3.5 h-3.5" /> },
];

export function NullerLeaderboard({ rawActions, isLoading, isError, onRefresh }: NullerLeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortMode>('cheese');

  const leaderboard = useMemo(() => {
    if (!rawActions.length) return [];
    return aggregateNullerStats(rawActions, sortBy);
  }, [rawActions, sortBy]);

  const getPrimaryValue = (entry: NullerStats) => {
    switch (sortBy) {
      case 'burns': return entry.burns.toLocaleString();
      default: return formatCheeseAmount(entry.cheeseNulled);
    }
  };

  const getPrimaryUnit = () => {
    switch (sortBy) {
      case 'burns': return 'burns';
      default: return 'CHEESE';
    }
  };

  const getSecondaryText = (entry: NullerStats) => {
    switch (sortBy) {
      case 'burns': return `${formatCheeseAmount(entry.cheeseNulled)} nulled`;
      default: return `${entry.burns} burns`;
    }
  };

  return (
    <Card className="w-full max-w-md bg-card/50 border-border/50">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-cheese" />
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              CHEESEBoard
            </h3>
            <Trophy className="w-4 h-4 text-cheese" />
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="ml-1 p-1 rounded-md text-muted-foreground hover:text-cheese hover:bg-cheese/10 transition-colors disabled:opacity-50"
                title="Refresh leaderboard"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              </button>
            )}
          </div>
        </div>

        {/* Sort Buttons */}
        <div className="flex gap-2 justify-center">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => setSortBy(opt.mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                sortBy === opt.mode
                  ? 'bg-cheese/20 text-cheese border border-cheese/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-sm text-destructive">Error loading leaderboard</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No data yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-cheese/10 hover:bg-transparent">
                <TableHead className="h-8 text-xs text-muted-foreground w-10">#</TableHead>
                <TableHead className="h-8 text-xs text-muted-foreground">Account</TableHead>
                <TableHead className="h-8 text-xs text-muted-foreground text-right">
                  {sortBy === 'burns' ? 'Burns' : 'Nulled'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry) => (
                <TableRow key={entry.account} className="border-cheese/5 hover:bg-cheese/5">
                  <TableCell className="py-2 text-sm font-bold text-cheese">
                    {entry.rank}
                  </TableCell>
                  <TableCell className="py-2">
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {entry.account}
                      </span>
                      <p className="text-[10px] text-muted-foreground">{getSecondaryText(entry)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <span className="text-sm font-bold text-cheese">{getPrimaryValue(entry)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">{getPrimaryUnit()}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
