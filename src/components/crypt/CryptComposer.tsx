import type { RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { YoutubeTitleHelper } from '@/components/crypt/YoutubeTitleHelper';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { VoiceRecorder } from '@/components/crypt/VoiceRecorder';
import { cn } from '@/lib/utils';
import type { ReplyRef } from '@/lib/cryptReply';
import { VOICE_PARTS_PER_TX, type VoiceClip } from '@/lib/cryptVoice';
import type { CryptGroup } from '@/lib/cryptGroups';
import type { InviteGroupView } from '@/lib/cryptInviteGroups';
import { MAX_PARTS, MAX_PLAINTEXT_BYTES, MESSAGE_FEE_QUANTITY, MESSAGE_RECIPIENT_QUANTITY, MESSAGE_TOTAL_QUANTITY, NFT_FEE_QUANTITY, PART_BODY_BYTES } from '@/lib/cheeseCrypt';

/** Message composer: reply bar, text box and footer (counter, NFT, voice, Terms, Fee info, price, Send). State lives in Messenger. */
export function CryptComposer({
  account, active, activeGroup, activeInvite, nameFor, replyingTo, setReplyingTo, composerRef, text, setText, voice, setVoice,
  tooLong, bytes, maxBytes, parts, copies, voiceParts, voiceTxs, setAttachingNft, busy, listHidden, agreed, setAgreed,
  feeInfoOpen, setFeeInfoOpen, totalCost, send, sendVoice, editing, cancelEdit, editExpired,
}: {
  account: string; active: string; activeGroup: CryptGroup | undefined; activeInvite: InviteGroupView | undefined; nameFor: (id: string) => string;
  replyingTo: ReplyRef | null; setReplyingTo: (r: ReplyRef | null) => void; composerRef: RefObject<HTMLTextAreaElement>;
  text: string; setText: (t: string) => void; voice: VoiceClip | null; setVoice: (v: VoiceClip | null) => void;
  tooLong: boolean; bytes: number; maxBytes: number; parts: number; copies: number; voiceParts: number; voiceTxs: number;
  setAttachingNft: (v: boolean) => void; busy: boolean; listHidden: boolean; agreed: boolean; setAgreed: (v: boolean) => void;
  feeInfoOpen: boolean; setFeeInfoOpen: (v: boolean) => void; totalCost: string; send: () => void; sendVoice: () => void;
  editing?: boolean; cancelEdit?: () => void; editExpired?: boolean;
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
        {listHidden && <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} className="ml-2" />}
        {/* Expanded chat: Terms, fee info, price and Send share one line. Compressed chat: they form the bottom line, Terms first, price and Send pushed to the right edge. */}
        <div className={cn('flex flex-wrap items-center gap-2 gap-y-1', !listHidden && 'order-last w-full')}>
          {!listHidden && <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} />}
          <Collapsible open={feeInfoOpen} onOpenChange={setFeeInfoOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cheese">
              ℹ️ Fee info <ChevronDown className={cn('h-3 w-3 transition', !feeInfoOpen && '-rotate-90')} />
            </CollapsibleTrigger>
          </Collapsible>
          <span className="ml-auto text-muted-foreground">{totalCost}</span>
          {voice
            ? <Button size="sm" disabled={busy || !agreed || editExpired} onClick={sendVoice} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{editing ? 'Save edit' : 'Send voice'}{voiceTxs > 1 ? ` (${voiceTxs} signatures)` : ''}</Button>
            : <Button size="sm" disabled={busy || !agreed || !text.trim() || tooLong || editExpired} onClick={send}
              className="bg-cheese text-primary-foreground hover:bg-cheese/90">{editing ? 'Save edit' : 'Send'}</Button>}
        </div>
        {feeInfoOpen && (
          <div className="order-last w-full basis-full space-y-1 pt-1">
      {voice && <p className="text-[11px] text-muted-foreground">🎙️ Voice note: {voiceParts} encrypted parts, up to {VOICE_PARTS_PER_TX} per transaction, signed one after another. A flat 1 CHEESE fee is paid once in the first transaction (0.8000 nulled, 0.2000 to xcheeseliqst), plus 0.0001 CHEESE per part to each recipient. If a later transaction fails, the parts already sent stay on chain and the note shows as incomplete.</p>}
      <p className="text-[11px] text-muted-foreground">
        {activeInvite ? `Each part: ${MESSAGE_FEE_QUANTITY} shared platform fee for the group + ${MESSAGE_RECIPIENT_QUANTITY} to each of the ${copies} members who joined. Members who haven't joined don't get a copy.` : activeGroup ? `Each part: ${MESSAGE_FEE_QUANTITY} shared platform fee for the group + ${MESSAGE_RECIPIENT_QUANTITY} to each of ${copies} recipients. Group delivery uses ${copies} encrypted copies in one transaction. Membership is fixed; start a new group to change participants.` : `Each part: ${MESSAGE_RECIPIENT_QUANTITY} to ${active} + ${MESSAGE_FEE_QUANTITY} platform fee (${MESSAGE_TOTAL_QUANTITY}). Long messages split into up to ${MAX_PARTS} parts (${MAX_PLAINTEXT_BYTES} bytes for one, ${PART_BODY_BYTES} per part after that), all in one transaction.`}
        {` Attaching an NFT raises the first part's platform fee to ${NFT_FEE_QUANTITY}. Platform fees split 80% to eosio.null and 20% to xcheeseliqst; recipient payments are unchanged.`}
      </p>
          </div>
        )}
      </div>
    </div>
  );
}
