import waxLogoUrl from '@/assets/wax-seal.png';
import cheeseLogoUrl from '@/assets/cheese-logo.png';
import type { ContractReserves } from '@/lib/cheeseRam';

interface LiquidReservesPanelProps {
  reserves: ContractReserves | null | undefined;
}

const formatNumber = (value: number, decimals = 4) =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function LiquidReservesPanel({ reserves }: LiquidReservesPanelProps) {
  const liquidWax = reserves?.liquidWax ?? 0;
  const cheesePool = reserves?.cheesePool ?? 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
      <div className="flex items-center gap-2 rounded-lg bg-card/50 border border-border/50 px-4 py-2">
        <img src={waxLogoUrl} alt="WAX" className="w-6 h-6 object-contain" />
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Liquid WAX</p>
          <p className="text-sm font-bold font-mono text-foreground">{formatNumber(liquidWax, 2)} WAX</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-card/50 border border-border/50 px-4 py-2">
        <img src={cheeseLogoUrl} alt="CHEESE" className="w-6 h-6 object-contain" />
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Liquid CHEESE</p>
          <p className="text-sm font-bold font-mono text-foreground">{formatNumber(cheesePool, 4)} CHEESE</p>
        </div>
      </div>
    </div>
  );
}

