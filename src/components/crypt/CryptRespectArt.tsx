import type { TrustMark } from '@/lib/cryptTrust';

/**
 * Custom illustrated Respect emblems (inline SVG, theme tokens only).
 * Mousetrap → Milk → Wedge → Fondue → Golden CHEESE wheel → Laurelled double-crowned wheel.
 */
const c = (v: string, a?: number) => a == null ? `hsl(var(--${v}))` : `hsl(var(--${v}) / ${a})`;

const RING: Record<TrustMark, string> = {
  warning: c('destructive'), low: c('muted-foreground'), moderate: c('cheese-dark'), good: c('accent'), strong: c('cheese'), huge: c('cheese-light'),
};

function Art({ mark }: { mark: TrustMark }) {
  const ink = c('foreground', 0.85);
  switch (mark) {
    case 'warning': return <g>
      <rect x="6" y="18" width="20" height="7" rx="1.5" fill={c('cheese-dark')} stroke={ink} strokeWidth="1" />
      <line x1="9" y1="20.5" x2="23" y2="20.5" stroke={ink} strokeWidth="0.6" opacity="0.5" />
      <path d="M8 18 V11 H24 V18" fill="none" stroke={c('muted-foreground')} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="16" cy="18" r="1.6" fill={c('muted-foreground')} stroke={ink} strokeWidth="0.6" />
      <path d="M19 18 l2.5 -3 l2.5 3 z" fill={c('cheese')} stroke={ink} strokeWidth="0.6" />
      <path d="M14 7.5 L16 4.5 L18 7.5 Z" fill={c('destructive')} />
    </g>;
    case 'low': return <g>
      <path d="M10 7 H22 L20.5 26 H11.5 Z" fill="hsl(200 30% 90% / 0.25)" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      <path d="M10.6 12 Q13 13 16 12 T21.4 12 L20.5 26 H11.5 Z" fill="hsl(40 30% 97%)" />
      <path d="M10.6 12 Q13 13 16 12 T21.4 12" fill="none" stroke={ink} strokeWidth="0.7" />
      <line x1="13" y1="15" x2="13.5" y2="23" stroke="hsl(200 20% 80%)" strokeWidth="1.2" strokeLinecap="round" />
    </g>;
    case 'moderate': return <g>
      <path d="M5 22 L26 11 L27 22 Z" fill={c('cheese')} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      <path d="M5 22 L27 22 L27 25 L5 25 Z" fill={c('cheese-dark')} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="19" cy="18" r="1.8" fill={c('cheese-dark')} />
      <circle cx="23.5" cy="15.5" r="1.1" fill={c('cheese-dark')} />
      <circle cx="13" cy="20.3" r="1" fill={c('cheese-dark')} />
      <circle cx="10" cy="23.5" r="0.8" fill={c('cheese')} />
    </g>;
    case 'good': return <g>
      <line x1="20" y1="3.5" x2="16.5" y2="13" stroke={c('muted-foreground')} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="16.3" cy="13.3" r="1.6" fill={c('cheese-light')} stroke={ink} strokeWidth="0.6" />
      <path d="M6 14 H26 L24 23 Q16 27 8 23 Z" fill={c('destructive', 0.85)} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      <path d="M6 14 H26 Q26 16.5 22.5 16 Q21.5 19 20 16.3 Q16 17 12.5 16.3 Q11 19.5 10 16 Q6 16.5 6 14 Z" fill={c('cheese')} stroke={ink} strokeWidth="0.7" />
      <rect x="4" y="13" width="24" height="1.8" rx="0.9" fill={c('foreground', 0.7)} />
      <path d="M11 27 L9.5 29 M21 27 L22.5 29" stroke={ink} strokeWidth="1.2" strokeLinecap="round" />
    </g>;
    case 'strong': return <g>
      <ellipse cx="16" cy="21" rx="10.5" ry="4.5" fill={c('cheese-dark')} stroke={ink} strokeWidth="1" />
      <rect x="5.5" y="15" width="21" height="6" fill={c('cheese-dark')} />
      <ellipse cx="16" cy="15" rx="10.5" ry="4.5" fill={c('cheese')} stroke={ink} strokeWidth="1" />
      <line x1="5.5" y1="15" x2="5.5" y2="21" stroke={ink} strokeWidth="1" />
      <line x1="26.5" y1="15" x2="26.5" y2="21" stroke={ink} strokeWidth="1" />
      <ellipse cx="13" cy="14.5" rx="1.6" ry="0.8" fill={c('cheese-dark')} />
      <ellipse cx="19.5" cy="16" rx="1.1" ry="0.6" fill={c('cheese-dark')} />
      <path d="M10 9.5 L11.5 5 L14 8 L16 4 L18 8 L20.5 5 L22 9.5 Z" fill={c('cheese-light')} stroke={ink} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M24.5 6 l0.6 1.4 1.4 0.6 -1.4 0.6 -0.6 1.4 -0.6 -1.4 -1.4 -0.6 1.4 -0.6 z" fill={c('cheese-light')} />
    </g>;
    case 'huge': {
      const leaf = c('accent');
      const leaves = (side: 1 | -1) => [0, 1, 2, 3].map(i => {
        const y = 24 - i * 3.6, x = 16 + side * (10.6 - i * 0.6);
        return <ellipse key={i} cx={x} cy={y} rx="1.1" ry="2.1" fill={leaf} stroke={ink} strokeWidth="0.4" transform={`rotate(${side * (35 - i * 12)} ${x} ${y})`} />;
      });
      return <g>
        <path d="M7.5 26 Q4.5 17 8.5 9.5 M24.5 26 Q27.5 17 23.5 9.5" fill="none" stroke={leaf} strokeWidth="0.9" strokeLinecap="round" />
        {leaves(-1)}{leaves(1)}
        <ellipse cx="16" cy="23" rx="7" ry="3" fill={c('cheese-dark')} stroke={ink} strokeWidth="0.9" />
        <rect x="9" y="19" width="14" height="4" fill={c('cheese-dark')} />
        <ellipse cx="16" cy="19" rx="7" ry="3" fill={c('cheese')} stroke={ink} strokeWidth="0.9" />
        <line x1="9" y1="19" x2="9" y2="23" stroke={ink} strokeWidth="0.9" />
        <line x1="23" y1="19" x2="23" y2="23" stroke={ink} strokeWidth="0.9" />
        <ellipse cx="14" cy="18.7" rx="1.1" ry="0.55" fill={c('cheese-dark')} />
        <ellipse cx="18.5" cy="19.6" rx="0.8" ry="0.4" fill={c('cheese-dark')} />
        <path d="M11 15.5 L11.8 12 L13.8 14 L16 10.8 L18.2 14 L20.2 12 L21 15.5 Z" fill={c('cheese')} stroke={ink} strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M12.5 11 L13.2 7.6 L14.8 9.4 L16 6.6 L17.2 9.4 L18.8 7.6 L19.5 11 Z" fill={c('cheese-light')} stroke={ink} strokeWidth="0.7" strokeLinejoin="round" />
        <circle cx="16" cy="13.9" r="0.75" fill={c('destructive')} />
        <circle cx="16" cy="9.9" r="0.6" fill={c('accent')} />
        <path d="M16 2.6 l0.5 1.2 1.2 0.5 -1.2 0.5 -0.5 1.2 -0.5 -1.2 -1.2 -0.5 1.2 -0.5 z" fill={c('cheese-light')} />
        <path d="M8.5 5.5 l0.4 0.9 0.9 0.4 -0.9 0.4 -0.4 0.9 -0.4 -0.9 -0.9 -0.4 0.9 -0.4 z" fill={c('cheese-light')} />
        <path d="M23.5 5.5 l0.4 0.9 0.9 0.4 -0.9 0.4 -0.4 0.9 -0.4 -0.9 -0.9 -0.4 0.9 -0.4 z" fill={c('cheese-light')} />
      </g>;
    }
  }
}

export function CryptRespectArt({ mark, size = 32, className }: { mark: TrustMark; size?: number; className?: string }) {
  return <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={className}>
    <circle cx="16" cy="16" r="15" fill={c('card')} stroke={RING[mark]} strokeWidth={mark === 'huge' ? 2.2 : 1.6} />
    <Art mark={mark} />
  </svg>;
}
