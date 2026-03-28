import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { WAX_EXPLORER } from '@/lib/waxConfig';
import type { DropPurchase } from '@/hooks/useDropPurchases';

interface DropPurchaseLogProps {
  purchases: DropPurchase[];
  isLoading: boolean;
}

export function DropPurchaseLog({ purchases, isLoading }: DropPurchaseLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="h-5 w-5 text-cheese" />
          CHEESEDrop — Recent Purchases
          {!isLoading && purchases.length > 0 && (
            <Badge variant="outline" className="ml-auto text-xs">
              {purchases.length} transactions
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : purchases.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            No recent purchases found. Hyperion may have limited history available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">NFT</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Drop ID</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p, i) => (
                  <TableRow key={`${p.txId}-${i}`}>
                    <TableCell className="p-1">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={`Drop #${p.dropId}`}
                          className="w-10 h-10 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">?</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {p.timestamp ? new Date(p.timestamp).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.buyer}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        #{p.dropId}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{p.amount}</TableCell>
                    <TableCell className="text-xs font-mono text-cheese">
                      {p.quantity}
                    </TableCell>
                    <TableCell>
                      {p.txId ? (
                        <a
                          href={`${WAX_EXPLORER}${p.txId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-mono"
                        >
                          {p.txId.slice(0, 8)}…
                        </a>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
