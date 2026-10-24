import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { parseReply, type ReplyRef } from '@/lib/cryptReply';
import { CryptNftCard } from '@/components/crypt/CryptNftCard';
import { fetchAssetById } from '@/services/atomicApi';
import { parseNftMessage } from '@/lib/cryptNft';
import type { CryptAvatar } from '@/lib/cryptAvatar';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { VoiceNoteBubble } from '@/components/crypt/VoiceNoteBubble';
import { voiceNoteCost } from '@/lib/cryptVoice';
import { groupMessageCost, type ConversationEntry, type CryptGroup } from '@/lib/cryptGroups';
import { messageCost } from '@/lib/cheeseCrypt';
import type { EditedMessage } from '@/lib/cryptEdits';

/** Pure sound-effect-NFT posts render without the bubble box — sender header, playback and timestamp stay. */
export function ChatMessageItem({ m, account, keyAvatar, avatars, contacts, active, activeGroup, nameFor, openedAt, onReply, onOpenQuote, highlighted, editable, onEdit, onCollapse, canReveal, revealed, onReveal }: {
  m: EditedMessage; account: string; keyAvatar?: CryptAvatar; avatars: Record<string, CryptAvatar>;
  contacts: Record<string, string>; active: string; activeGroup: CryptGroup | null;
  nameFor: (id: string) => string; openedAt: { current: number };
  onReply: (m: ConversationEntry) => void; onOpenQuote: (ref: ReplyRef) => void;
  highlighted: boolean;
  editable?: boolean; onEdit?: (m: ConversationEntry) => void;
  /** Public-room moderation: collapse action (when allowed) and moderator-only reveal of collapsed rows. */
  onCollapse?: () => void; canReveal?: boolean; revealed?: boolean; onReveal?: () => void;
}) {
  const hidden = !!m.collapsed && !revealed;
  const reply = parseReply(m.text);
  const body = reply ? reply.body : m.text;
  const segments = body != null ? parseNftMessage(body) : null;
  const soloAssetId = segments && segments.length === 1 && segments[0].type === 'nft' ? segments[0].assetId : null;
  const { data } = useQuery({
    queryKey: ['crypt-nft', soloAssetId], queryFn: () => { if (!soloAssetId) throw new Error('Missing asset'); return fetchAssetById(soloAssetId); },
    enabled: !!soloAssetId, staleTime: 3600_000,
  });
  const bare = !!soloAssetId && !!data?.isSfx;
  const canReply = (!!m.voice || m.text != null) && !hidden;
  return (
    <ContextMenu>
    <ContextMenuTrigger asChild disabled={!canReply && !onCollapse}>
    <li data-reply-key={m.key} data-reply-highlighted={highlighted || undefined} className={cn('w-fit max-w-[80%] text-sm',
      bare ? (m.from === account ? 'ml-auto py-1' : 'py-1') : m.from === account
        ? 'ml-auto rounded-lg px-3 py-2 bg-cheese/20 border border-cheese/30' : 'rounded-lg px-3 py-2 bg-muted',
      highlighted && 'ring-2 ring-reply bg-reply/10')}>
      <div className="flex items-center gap-2 mb-1">
        <PixelAvatar account={m.from} avatar={m.from === account ? keyAvatar : avatars[m.from]} className="h-6 w-6" />
        <p className="text-[10px] font-semibold opacity-80 break-words">{m.from === account ? `you · ${nameFor(account)}` : nameFor(m.from)}{nameFor(m.from) !== m.from && <span className="block font-normal">{m.from}</span>}</p>
      </div>
      {hidden ? <p className="italic opacity-70">🙈 Message collapsed by a moderator{canReveal && onReveal && <> · <button type="button" className="not-italic font-semibold text-cheese underline underline-offset-2" onClick={onReveal}>Show</button></>}</p> : <>
      {m.collapsed && <p className="mb-1 text-[10px] text-muted-foreground">🙈 Collapsed by {nameFor(m.collapsed.by)} · visible to moderators</p>}
      {reply && <button type="button" onClick={() => onOpenQuote(reply)} aria-label={`Show the message from ${nameFor(reply.author)} this replies to`}
        className="mb-1 block w-full max-w-full rounded border-l-2 border-reply bg-background/60 px-2 py-1 text-left text-xs hover:bg-background">
        <span className="block font-semibold text-reply">↩️ {reply.author === account ? 'you' : nameFor(reply.author)}</span>
        <span className="block truncate opacity-80">{reply.quote || '…'}</span>
      </button>}
      <div className="whitespace-pre-wrap break-words">
        {m.voice ? <VoiceNoteBubble note={m.voice} /> : body != null ? parseNftMessage(body).map((seg, i) => seg.type === 'nft' ? <CryptNftCard key={i} assetId={seg.assetId} autoplayKey={m.time > openedAt.current ? `${m.key}:${i}` : undefined} txId={m.txId} /> : <span key={i} className="block">{seg.text}</span>) : <em className="opacity-70">{contacts[active] ? "Can't read this one: it was sent with a different key." : `Can't read yet: load ${active}'s public key first.`}</em>}
      </div>
      </>}
      <p className="text-[10px] opacity-70 mt-1">
        {new Date(m.time).toLocaleString()}{m.editedAt && <span title={new Date(m.editedAt).toLocaleString()}> · (edited)</span>}{m.igroup ? null : ' · '}{m.igroup ? null : m.voice ? `${voiceNoteCost(m.parts, m.group ? m.group.members.length - 1 : 1)} at current rate` : m.group ? `${groupMessageCost(m.parts, m.group.members.length - 1, !!m.text && parseNftMessage(m.text).some(x => x.type === 'nft'))} at current rate` : messageCost(m.parts, !!m.text && parseNftMessage(m.text).some(x => x.type === 'nft'))}
        {m.parts > 1 && ` · ${m.parts} parts`}
        {m.missing > 0 && !m.voice && <span className="text-destructive"> · {m.missing} part{m.missing > 1 ? 's' : ''} not loaded</span>}
        {m.txId && <> · <a href={`https://waxblock.io/transaction/${encodeURIComponent(m.txId)}`} target="_blank" rel="noreferrer"
          className="font-semibold text-cheese underline underline-offset-2 hover:text-cheese/80">Tx</a></>}
      </p>
    </li>
    </ContextMenuTrigger>
    <ContextMenuContent>
      {canReply && <ContextMenuItem onSelect={() => onReply(m)}>↩️ Reply</ContextMenuItem>}
      {editable && onEdit && !hidden && <ContextMenuItem onSelect={() => onEdit(m)}>✏️ Edit</ContextMenuItem>}
      {onCollapse && !m.collapsed && <ContextMenuItem onSelect={onCollapse}>🙈 Collapse message</ContextMenuItem>}
    </ContextMenuContent>
    </ContextMenu>
  );
}
