import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Profile tile: icon over a short visible label so every action is readable without hovering. */
export const CardAction = forwardRef<HTMLButtonElement, ButtonProps & { icon: ReactNode; label: string }>(function CardAction({ icon, label, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      className={cn('h-auto w-full flex-col gap-1.5 rounded-md px-1 py-2 text-muted-foreground hover:text-cheese', className)}
      {...props}
    >
      {icon}
      <span className="text-[10px] leading-none font-semibold">{label}</span>
    </Button>
  );
});
