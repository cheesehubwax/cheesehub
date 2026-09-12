// Real image files (not CDN asset pointers) so the logos also work on the
// GitHub Pages deployment, which cannot serve Lovable /__l5e/ asset URLs.
import alcorLogo from '@/assets/venues/alcor.png';
import defiboxLogo from '@/assets/venues/defibox.png';
import tacoSwapLogo from '@/assets/venues/tacoswap.png';
import { cn } from '@/lib/utils';
import { LP_VENUE_LABELS, type LpVenue } from '@/lib/lpPools';

const VENUE_LOGOS: Record<LpVenue, string> = {
  alcor: alcorLogo,
  taco: tacoSwapLogo,
  defibox: defiboxLogo,
};

interface VenueLogoProps {
  venue: LpVenue;
  className?: string;
}

export function VenueLogo({ venue, className }: VenueLogoProps) {
  return (
    <img
      src={VENUE_LOGOS[venue]}
      alt=""
      aria-hidden="true"
      className={cn(
        'h-4 w-4 shrink-0 object-contain',
        className,
      )}
    />
  );
}

interface VenueLabelProps {
  venue: LpVenue;
  className?: string;
}

export function VenueLabel({ venue, className }: VenueLabelProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <VenueLogo venue={venue} />
      <span>{LP_VENUE_LABELS[venue] ?? venue}</span>
    </span>
  );
}

export function AllVenueLogos({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden="true">
      <VenueLogo venue="alcor" className="h-4 w-4" />
      <VenueLogo venue="taco" className="h-4 w-4" />
      <VenueLogo venue="defibox" className="h-4 w-4" />
    </span>
  );
}