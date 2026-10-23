import { describe, it, expect } from 'vitest';
import { encodeReply, parseReply, quoteOf, QUOTE_MAX_CHARS } from '@/lib/cryptReply';
import { unreadReplies, unreadCounts } from '@/lib/cryptUnread';

describe('CHEESECrypt replies', () => {
  it('round-trips the quoted author, time and snippet above the reply body', () => {
    const t = encodeReply({ author: 'alice', time: 1761230000000, quote: 'hello there' }, 'hi back\nline 2');
    expect(parseReply(t)).toEqual({ author: 'alice', time: 1761230000000, quote: 'hello there', body: 'hi back\nline 2' });
    expect(parseReply('plain message')).toBeNull();
  });
  it('quotes are one line, capped, drop nested quotes and label NFTs', () => {
    const nested = encodeReply({ author: 'bob', time: 1, quote: 'old' }, 'look [nft:123]\nnow');
    expect(quoteOf(nested)).toBe('look 🖼️ NFT now');
    expect(Array.from(quoteOf('x'.repeat(200))).length).toBe(QUOTE_MAX_CHARS);
    expect(quoteOf(null, true)).toBe('🎙️ Voice note');
  });
  it('counts only unread incoming replies to my own messages for the reply colour', () => {
    const me = 'alice';
    const msgs = [
      { from: 'bob', to: me, time: 5, group: null, text: encodeReply({ author: me, time: 1, quote: 'q' }, 'r') },
      { from: 'bob', to: me, time: 6, group: null, text: encodeReply({ author: 'bob', time: 2, quote: 'q' }, 'r') },
      { from: 'bob', to: me, time: 7, group: null, text: 'plain' },
      { from: 'bob', to: me, time: 1, group: null, text: encodeReply({ author: me, time: 0, quote: 'q' }, 'old') },
    ];
    expect(unreadReplies(msgs, me, { bob: 2 })).toEqual({ bob: 1 });
    expect(unreadCounts(msgs, me, { bob: 2 })).toEqual({ bob: 3 });
  });
});
