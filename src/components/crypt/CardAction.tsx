import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Profile tile: icon over a short visible label so every action is readable without hovering. */
export function CardAction({ icon, label, className, row, ...props }: ButtonProps & { icon: ReactNode; label: string; row?: boolean }) {
  if (row) return (
    <Button variant="ghost" className={cn('h-8 w-full justify-start gap-2 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:text-cheese', className)} {...props}>
      {icon}<span className="truncate">{label}</span>
    </Button>
  );
  return (
    <Button
      variant="ghost"
      className={cn('h-auto w-full min-w-0 flex-col gap-1.5 rounded-md px-1 py-2 text-muted-foreground whitespace-normal hover:text-cheese', className)}
      {...props}
    >
      {icon}
      <span className="text-[10px] leading-tight font-semibold break-words line-clamp-2">{label}</span>
    </Button>
  );
}
