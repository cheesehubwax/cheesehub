import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Profile tile: icon over a short visible label so every action is readable without hovering. */
export function CardAction({ icon, label, className, ...props }: ButtonProps & { icon: ReactNode; label: string }) {
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
