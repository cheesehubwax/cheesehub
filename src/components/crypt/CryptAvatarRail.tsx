import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { cn } from '@/lib/utils';
import type { CryptAvatar } from '@/lib/cryptAvatar';

export interface RailItem { id: string; label: string; avatarAccount: string; avatar?: CryptAvatar; emoji?: string; unread: number; replies: number }

/** Thin edge strip shown while the side panel is collapsed: one avatar per room/friend with its unread and reply counters. */
export function CryptAvatarRail({ items, active, setActive }: { items: RailItem[]; active: string | null; setActive: (id: string) => void }) {
  return (
    <nav aria-label="Chats" className="hidden md:flex w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border py-3">
      {items.map(it => (
        <button key={it.id} type="button" onClick={() => setActive(it.id)} title={it.label}
          aria-label={`${it.label}${it.unread ? `, ${it.unread} unread` : ''}${it.replies ? `, ${it.replies} repl${it.replies > 1 ? 'ies' : 'y'} to you` : ''}`}
          aria-current={active === it.id ? 'true' : undefined}
          className={cn('relative shrink-0 rounded-md p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active === it.id ? 'ring-2 ring-cheese' : 'hover:bg-muted')}>
          {it.emoji ? <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded border border-border bg-muted text-2xl">{it.emoji}</span>
            : <PixelAvatar account={it.avatarAccount} avatar={it.avatar} className="h-11 w-11" />}
          {it.unread > 0 && <span aria-hidden className="absolute -right-1.5 -top-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-center bg-cheese text-primary-foreground">{it.unread > 99 ? '99+' : it.unread}</span>}
          {it.replies > 0 && <span aria-hidden data-reply="true" className="absolute -bottom-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-center bg-reply text-reply-foreground">@{it.replies > 99 ? '99+' : it.replies}</span>}
        </button>
      ))}
    </nav>
  );
}
