import { startTransition, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { YoutubeTitleHelper } from '@/components/crypt/YoutubeTitleHelper';
import { Textarea } from '@/components/ui/textarea';
import { VoiceRecorder } from '@/components/crypt/VoiceRecorder';
import type { ReplyRef } from '@/lib/cryptReply';
import type { VoiceClip } from '@/lib/cryptVoice';
import type { CryptGroup } from '@/lib/cryptGroups';
import type { InviteGroupView } from '@/lib/cryptInviteGroups';
import { loadSendJitter, pickJitterSeconds } from '@/lib/cryptNetworkPrivacy';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SCHEDULE_PRESETS, formatLeft, nextLocalTime, secondsLeft } from '@/lib/cryptSchedule';

/** Message composer: reply bar, text box and footer (counter, NFT, voice, price, Instant, Send). State lives in Messenger. */
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
  // Instant local draft: keystrokes update only this box; the chat screen gets the text as a low-priority update.
  const [draft, setDraft] = useState(text);
  // Values this box sent up that may still echo back late; an echo of our own typing must never overwrite the draft
  // (that would reset the textarea and snap the caret to the end mid-edit).
  const inFlight = useRef<string[]>([]);
  const [sendQueued, setSendQueued] = useState(false);
  useEffect(() => {
    const i = inFlight.current.lastIndexOf(text);
    if (i >= 0) { inFlight.current = inFlight.current.slice(i + 1); return; }
    inFlight.current = [];
    setDraft(text);
  }, [text]);
  const push = (v: string) => { inFlight.current.push(v); if (inFlight.current.length > 200) inFlight.current.shift(); };
  const onType = (v: string) => { setDraft(v); push(v); startTransition(() => setText(v)); };
  // Send must use the newest text: commit the draft urgently, then send once the screen has it.
  const sendNow = () => { if (draft === text) doSend(); else { push(draft); setText(draft); setSendQueued(true); } };
  // Optional random send delay (Privacy settings) or a per-message scheduled time: count down locally against the
  // wall clock (so a throttled background tab still fires on time once it wakes), then run the same send. Leaving the chat cancels it.
  const [delay, setDelay] = useState<{ until: number; left: number; run: 'text' | 'voice'; scheduled: boolean } | null>(null);
  const sendRef = useRef({ send, sendVoice }); sendRef.current = { send, sendVoice };
  const fire = (run: 'text' | 'voice') => { if (run === 'voice') sendRef.current.sendVoice(); else sendRef.current.send(); };
  const startDelay = (ms: number, run: 'text' | 'voice', scheduled: boolean) => { const until = Date.now() + ms; setDelay({ until, left: secondsLeft(until), run, scheduled }); };
  const doSend = () => { const j = loadSendJitter(); if (j.enabled) startDelay(pickJitterSeconds(j) * 1000, 'text', false); else send(); };
  const doSendVoice = () => { const j = loadSendJitter(); if (j.enabled) startDelay(pickJitterSeconds(j) * 1000, 'voice', false); else sendVoice(); };
  // Scheduling commits the newest draft first (same as Send), then starts the countdown.
  const [schedOpen, setSchedOpen] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [queuedSchedule, setQueuedSchedule] = useState<number | null>(null);
  const schedule = (until: number) => {
    setSchedOpen(false);
    const run = voice ? 'voice' : 'text';
    if (run === 'text' && draft !== text) { push(draft); setText(draft); setQueuedSchedule(until); return; }
    setDelay({ until, left: secondsLeft(until), run, scheduled: true });
  };
  useEffect(() => { if (queuedSchedule !== null && text === draft) { const until = queuedSchedule; setQueuedSchedule(null); setDelay({ until, left: secondsLeft(until), run: 'text', scheduled: true }); } }, [queuedSchedule, text, draft]);
  useEffect(() => {
    if (!delay) return;
    if (delay.left <= 0) { setDelay(null); fire(delay.run); return; }
    const t = setTimeout(() => setDelay(d => d && { ...d, left: secondsLeft(d.until) }), 1000);
    return () => clearTimeout(t);
  }, [delay]);
  useEffect(() => { setDelay(null); setQueuedSchedule(null); }, [active]);
  useEffect(() => { if (sendQueued && text === draft) { setSendQueued(false); doSend(); } }, [sendQueued, text, draft, send]);
  const pending = draft !== text;
  return (
    <div className="space-y-2 p-4 border-t border-border">
      {editing && <div className="flex items-center gap-2 border-l-2 border-cheese bg-muted px-2 py-1 text-xs"><span className="flex-1">✏️ {editExpired ? 'Editing window ended' : 'Editing message'}</span><Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Cancel edit" onClick={cancelEdit}>✕</Button></div>}
      {replyingTo && <div className="flex items-start gap-2 rounded border-l-2 border-reply bg-muted px-2 py-1 text-xs">
        <span className="min-w-0 flex-1"><span className="block font-semibold text-reply">↩️ Replying to {replyingTo.author === account ? 'yourself' : nameFor(replyingTo.author)}</span><span className="block truncate opacity-80">{replyingTo.quote || '…'}</span></span>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}>✕</Button>
      </div>}
      <Textarea ref={composerRef} value={draft} onChange={(e) => onType(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && editing) cancelEdit?.(); }} rows={3} disabled={!!voice || busy || !!delay || queuedSchedule !== null} placeholder={voice ? 'Sending a voice note — discard it to type a message' : activeGroup || activeInvite ? 'Message group' : `Message ${nameFor(active)}`} />
      {!voice && <YoutubeTitleHelper text={draft} setText={setText} disabled={busy} />}
      <div className="flex flex-wrap items-center gap-2 gap-y-1 text-xs">
        <span className={!voice && tooLong ? 'text-destructive' : 'text-muted-foreground'}>
          {voice ? `${voiceParts} parts · ${voiceTxs} transaction${voiceTxs > 1 ? 's' : ''}` : `${bytes}/${maxBytes} · ${parts || 1} part${parts > 1 ? 's' : ''}`}{(activeGroup || activeInvite) && ` × ${copies} recipients`}
        </span>
        {!voice && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAttachingNft(true); }}>🖼️ Attach NFT</Button>}
        {!draft.trim() && <VoiceRecorder clip={voice} onChange={setVoice} disabled={busy || !!delay} />}
      </div>
      {delay && <div role="status" className="flex flex-wrap items-center gap-2 rounded border border-cheese/50 bg-muted px-2 py-1 text-xs">
        <span className="flex-1">{delay.scheduled
          ? <>⏰ Scheduled for {new Date(delay.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · sending in {formatLeft(delay.left)}. Keep this chat open; your wallet may ask you to approve when it sends.</>
          : <>⏳ Sending in {delay.left}s… (random delay)</>}</span>
        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDelay(d => d && { ...d, left: 0 })}>Send now</Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setDelay(null)}>Cancel</Button>
      </div>}
      {/* Bottom line: price, Instant and Send on the right. */}
      <div className="flex flex-wrap items-center gap-2 gap-y-1 pr-6 text-xs">
        <span className="ml-auto text-muted-foreground">{totalCost}</span>
        {instantSlot}
        <Popover open={schedOpen} onOpenChange={setSchedOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 px-2" aria-label="Schedule send" title={editing ? 'Edits send straight away' : 'Schedule send'} disabled={!(!busy && !sendQueued && queuedSchedule === null && !delay && agreed && !editing && (voice ? true : !!draft.trim() && !(!pending && tooLong)))}>⏰</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-2 text-xs">
            <p className="font-semibold">⏰ Schedule this message</p>
            <p className="text-muted-foreground">It waits in this tab and sends at the chosen time. Keep CHEESECrypt open on this chat and your computer awake; leaving the chat or closing the tab cancels it.</p>
            <div className="grid grid-cols-2 gap-1">
              {SCHEDULE_PRESETS.map(p => <Button key={p.minutes} size="sm" variant="outline" className="h-7 text-xs" onClick={() => schedule(Date.now() + p.minutes * 60000)}>{p.label}</Button>)}
            </div>
            <div className="flex items-center gap-1">
              <label htmlFor="crypt-sched-time" className="shrink-0">At</label>
              <input id="crypt-sched-time" type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1 text-foreground" />
              <Button size="sm" className="h-7 bg-cheese text-xs text-primary-foreground hover:bg-cheese/90" disabled={nextLocalTime(customTime) === null} onClick={() => { const t = nextLocalTime(customTime); if (t !== null) schedule(t); }}>Schedule</Button>
            </div>
            <p className="text-muted-foreground">A time that has already passed today means tomorrow (up to 24 hours ahead).</p>
          </PopoverContent>
        </Popover>
        {voice
          ? <Button size="sm" disabled={busy || !!delay || !agreed || editExpired} onClick={doSendVoice} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{editing ? 'Save edit' : 'Send voice'}{voiceTxs > 1 ? ` (${voiceTxs} signatures)` : ''}</Button>
          : <Button size="sm" disabled={busy || sendQueued || !!delay || !agreed || !draft.trim() || (!pending && tooLong) || editExpired} onClick={sendNow}
            className="bg-cheese text-primary-foreground hover:bg-cheese/90">{editing ? 'Save edit' : 'Send'}</Button>}
      </div>
    </div>
  );
}
