import { parseReply } from '@/lib/cryptReply';
import { parseNftMessage } from '@/lib/cryptNft';

/** Plain, local request preview; media is not loaded before accepting the sender. */
export function CryptInboxPreview({ text }: { text: string | null }) {
  return <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
    {parseNftMessage(parseReply(text)?.body ?? text ?? '').map(s => s.type === 'nft' ? '🖼️ Sent an NFT' : s.text).join(' ')}
  </p>;
}