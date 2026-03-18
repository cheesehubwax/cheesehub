import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReactNode } from 'react';

interface StatusRow {
  label: string;
  value: string | number | ReactNode;
  warn?: boolean;
  critical?: boolean;
}

interface ContractStatusCardProps {
  title: string;
  icon?: ReactNode;
  rows: StatusRow[];
  children?: ReactNode;
  status?: 'ok' | 'warn' | 'critical';
}

export function ContractStatusCard({ title, icon, rows, children, status = 'ok' }: ContractStatusCardProps) {
  const statusColors = {
    ok: 'border-green-500/30',
    warn: 'border-yellow-500/30',
    critical: 'border-red-500/30',
  };
  const badgeColors = {
    ok: 'bg-green-500/20 text-green-400',
    warn: 'bg-yellow-500/20 text-yellow-400',
    critical: 'bg-red-500/20 text-red-400',
  };

  return (
    <Card className={`${statusColors[status]} border`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <Badge className={badgeColors[status]}>
            {status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Critical'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={row.critical ? 'text-red-400 font-semibold' : row.warn ? 'text-yellow-400' : 'text-foreground'}>
              {row.value}
            </span>
          </div>
        ))}
        {children}
      </CardContent>
    </Card>
  );
}
