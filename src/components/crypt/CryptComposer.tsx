import type { ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { YoutubeTitleHelper } from '@/components/crypt/YoutubeTitleHelper';
import { Textarea } from '@/components/ui/textarea';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { VoiceRecorder } from '@/components/crypt/VoiceRecorder';
import type { ReplyRef } from '@/lib/cryptReply';
import type { VoiceClip } from '@/lib/cryptVoice';
import type { CryptGroup } from '@/lib/cryptGroups';
import type { InviteGroupView } from '@/lib/cryptInviteGroups';

/** Message composer: reply bar, text box and footer (counter, NFT, voice, Terms, price, Instant, Send). State lives in Messenger. */
export function CryptComposer({
  account, active, activeGroup, activeInvite, nameFor, replyingTo, setReplyingTo, composerRef, text, setText, voice, setVoice,
  tooLong, bytes, maxBytes, parts, copies, voiceParts, voiceTxs, setAttachingNft, busy, listHidden, agreed, setAgreed,
  totalCost, send, sendVoice, editing, cancelEdit, editExpired, instantSlot,
}: {
  account: string; active: string; activeGroup: CryptGroup | undefined; activeInvite: InviteGroupView | undefined; nameFor: (id: string) => string;
  replyingTo: ReplyRef | null; setReplyingTo: (r: ReplyRef | null) => void; composerRef: RefObject<HTMLTextAreaElement>;
  text: string; setText: (t: string) => void; voice: VoiceClip | null; setVoice: (v: VoiceClip | null) => void;
  tooLong: boolean; bytes: number; maxBytes: number; parts: number; copies: number; voiceParts: number; voiceTxs: number;
  setAttachingNft: (v: boolean) => void; busy: boolean; listHidden: boolean; agreed: boolean; setAgreed: (v: boolean) => void;
  totalCost: string; send: () => void; sendVoice: () => void;
  editing?: boolean; cancelEdit?: () => void; editExpired?: boolean; instantSlot?: ReactNode;
}) {
  return (
    <div className="space-y-2 p-4 border-t border-border">
      {editing && <div className="flex items-center gap-2 border-l-2 border-cheese bg-muted px-2 py-1 text-xs"><span className="flex-1">✏️ {editExpired ? 'Editing window ended' : 'Editing message'}</span><Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Cancel edit" onClick={cancelEdit}>✕</Button></div>}
      {replyingTo && <div className="flex items-start gap-2 rounded border-l-2 border-reply bg-muted px-2 py-1 text-xs">
        <span className="min-w-0 flex-1"><span className="block font-semibold text-reply">↩️ Replying to {replyingTo.author === account ? 'yourself' : nameFor(replyingTo.author)}</span><span className="block truncate opacity-80">{replyingTo.quote || '…'}</span></span>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}>✕</Button>
      </div>}
      <Textarea ref={composerRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && editing) cancelEdit?.(); }} rows={3} disabled={!!voice || busy} placeholder={voice ? 'Sending a voice note — discard it to type a message' : activeGroup || activeInvite ? 'Message group' : `Message ${nameFor(active)}`} />
      {!voice && <YoutubeTitleHelper text={text} setText={setText} disabled={busy} />}
      <div className="flex flex-wrap items-center gap-2 gap-y-1 text-xs">
        <span className={!voice && tooLong ? 'text-destructive' : 'text-muted-foreground'}>
          {voice ? `${voiceParts} parts · ${voiceTxs} transaction${voiceTxs > 1 ? 's' : ''}` : `${bytes}/${maxBytes} · ${parts || 1} part${parts > 1 ? 's' : ''}`}{(activeGroup || activeInvite) && ` × ${copies} recipients`}
        </span>
        {!voice && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAttachingNft(true); }}>🖼️ Attach NFT</Button>}
        {!text.trim() && <VoiceRecorder clip={voice} onChange={setVoice} disabled={busy} />}
      </div>
      {/* Bottom line: Terms on the left; price, Instant and Send on the right. */}
      <div className="flex flex-wrap items-center gap-2 gap-y-1 pr-6 text-xs">
        <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} />
        <span className="ml-auto text-muted-foreground">{totalCost}</span>
        {instantSlot}
        {voice
          ? <Button size="sm" disabled={busy || !agreed || editExpired} onClick={sendVoice} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{editing ? 'Save edit' : 'Send voice'}{voiceTxs > 1 ? ` (${voiceTxs} signatures)` : ''}</Button>
          : <Button size="sm" disabled={busy || !agreed || !text.trim() || tooLong || editExpired} onClick={() => send()}
            className="bg-cheese text-primary-foreground hover:bg-cheese/90">{editing ? 'Save edit' : 'Send'}</Button>}
      </div>
    </div>
  );
}
