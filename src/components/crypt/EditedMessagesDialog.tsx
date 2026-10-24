import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CryptNftCard } from '@/components/crypt/CryptNftCard';
import { VoiceNoteBubble } from '@/components/crypt/VoiceNoteBubble';
import { parseNftMessage } from '@/lib/cryptNft';
import { parseReply } from '@/lib/cryptReply';
import type { ConversationEntry } from '@/lib/cryptGroups';
import type { EditLogEntry } from '@/lib/cryptEdits';

const Content = ({ message }: { message: ConversationEntry }) => message.voice ? <VoiceNoteBubble note={message.voice} /> : <div className="whitespace-pre-wrap break-words">{parseNftMessage(parseReply(message.text)?.body ?? message.text ?? '').map((s, i) => s.type === 'nft' ? <CryptNftCard key={i} assetId={s.assetId} /> : <span key={i}>{s.text}</span>)}</div>;
export function EditedMessagesDialog({ entries, onClose, nameFor }: { entries: EditLogEntry[]; onClose: () => void; nameFor: (account: string) => string }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>✏️ Edited messages</DialogTitle><DialogDescription>Past 72 hours · public room owner only. Shows edits from loaded history; busy rooms may have gaps. Blockchain records remain permanent.</DialogDescription></DialogHeader>
      <ol aria-label="Edited messages log" className="max-h-[60dvh] overflow-y-auto divide-y divide-border text-sm">
        {entries.map(e => <li key={`${e.original.key}:${e.at}:${e.replacement.editTxId ?? ''}`} className="space-y-2 py-3">
          <p className="text-xs text-muted-foreground">{nameFor(e.original.from)} · {new Date(e.at).toLocaleString()}</p>
          <p className="font-semibold">Before</p><Content message={e.previous} />
          <p className="font-semibold text-cheese">After</p><Content message={e.replacement} />
        </li>)}
        {!entries.length && <li className="py-4 text-muted-foreground">No edits in the past 72 hours.</li>}
      </ol>
    </DialogContent>
  </Dialog>;
}