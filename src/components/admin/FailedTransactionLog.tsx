import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import type { FailedTransaction } from '@/hooks/useFailedTransactions';

interface FailedTransactionLogProps {
  transactions: FailedTransaction[];
  isLoading: boolean;
}

export function FailedTransactionLog({ transactions, isLoading }: FailedTransactionLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClockCounterClockwise className="h-5 w-5" />
          Recent Failed Transactions — Last 24h
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
        ) : transactions.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <p className="text-muted-foreground text-sm">No failed transactions detected in the last 24 hours.</p>
            <p className="text-muted-foreground text-xs">
              Note: Hyperion may not index all failed transactions. Check the deviation gauges above for proactive monitoring.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{new Date(tx.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{tx.contract}</TableCell>
                  <TableCell>{tx.action}</TableCell>
                  <TableCell className="text-red-400 text-xs">{tx.error}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
