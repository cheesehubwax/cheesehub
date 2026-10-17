import { accountAvatar, CryptAvatar, parseAvatar } from '@/lib/cryptAvatar';
import { cn } from '@/lib/utils';

export function PixelAvatar({ account, avatar, className }: { account: string; avatar?: CryptAvatar; className?: string }) {
  const pixels = (parseAvatar(avatar) ?? accountAvatar(account)).pixels;
  return <svg role="img" aria-label={`${account}'s avatar`} viewBox="0 0 8 8" shapeRendering="crispEdges"
    className={cn('h-8 w-8 shrink-0 rounded border border-border bg-muted', className)}>
    {Array.from(pixels, (pixel, i) => pixel !== '0' && <rect key={i} x={i % 8} y={Math.floor(i / 8)} width="1" height="1" fill={`var(--avatar-${parseInt(pixel, 16)})`} />)}
  </svg>;
}