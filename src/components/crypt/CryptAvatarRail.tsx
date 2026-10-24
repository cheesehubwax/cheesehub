import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { cn } from '@/lib/utils';
import type { CryptAvatar } from '@/lib/cryptAvatar';

export interface RailItem { id: string; label: string; avatarAccount: string; avatar?: CryptAvatar; emoji?: string; unread: number; replies: number }

/** One labelled block of the collapsed strip, mirroring the Groups / Friends sections of the side panel. */
export interface RailSection { id: string; label: string; emoji: string; items: RailItem[] }

function RailButton({ item, active, setActive }: { item: RailItem; active: string | null; setActive: (id: string) => void }) {
  return (
    <button type="button" onClick={() => setActive(item.id)} title={item.label}
      aria-label={`${item.label}${item.unread ? `, ${item.unread} unread` : ''}${item.replies ? `, ${item.replies} repl${item.replies > 1 ? 'ies' : 'y'} to you` : ''}`}
      aria-current={active === item.id ? 'true' : undefined}
      className={cn('relative shrink-0 rounded-md p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active === item.id ? 'ring-2 ring-cheese' : 'hover:bg-muted')}>
      {item.emoji ? <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded border border-border bg-muted text-2xl">{item.emoji}</span>
        : <PixelAvatar account={item.avatarAccount} avatar={item.avatar} className="h-11 w-11" />}
      {item.unread > 0 && <span aria-hidden className="absolute -right-1.5 -top-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-center bg-cheese text-primary-foreground">{item.unread > 99 ? '99+' : item.unread}</span>}
      {item.replies > 0 && <span aria-hidden data-reply="true" className="absolute -bottom-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-center bg-reply text-reply-foreground">@{item.replies > 99 ? '99+' : item.replies}</span>}
    </button>
  );
}

/** Thin edge strip shown while the side panel is collapsed: rooms and friends in their own labelled sections, one avatar each with its unread and reply counters. */
export function CryptAvatarRail({ sections, active, setActive }: { sections: RailSection[]; active: string | null; setActive: (id: string) => void }) {
  const shown = sections.filter(s => s.items.length);
  return (
    <nav aria-label="Chats" className="hidden md:flex w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border py-3">
      {shown.map((s, i) => (
        <div key={s.id} role="group" aria-label={s.label} className={cn('flex w-full shrink-0 flex-col items-center gap-2', i > 0 && 'mt-1 border-t border-border pt-2')}>
          <span className="flex flex-col items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <span aria-hidden className="text-sm leading-none">{s.emoji}</span>
            <span>{s.label}</span>
          </span>
          {s.items.map(it => <RailButton key={it.id} item={it} active={active} setActive={setActive} />)}
        </div>
      ))}
    </nav>
  );
}
