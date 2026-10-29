import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchYoutubeTitle, untitledYoutubeLinks, withYoutubeTitle } from '@/lib/cryptYoutube';

/**
 * Composer helper: when the draft has YouTube links without a title, the sender can tap to look the
 * titles up once (private mirror first). The title is then sent inside the encrypted message, so
 * readers never make a request to see it. Nothing is fetched without the tap.
 */
export function YoutubeTitleHelper({ text, setText, disabled }: { text: string; setText: (t: string) => void; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const links = untitledYoutubeLinks(text);
  if (!links.length) return null;

  const addTitles = async () => {
    setLoading(true); setFailed(false);
    let next = text, missed = false;
    for (const l of links) {
      const title = await fetchYoutubeTitle(l.id);
      if (title) next = withYoutubeTitle(next, l.url, title); else missed = true;
    }
    setLoading(false);
    setFailed(missed);
    // Only apply when the draft hasn't changed meanwhile, so typing is never overwritten.
    setText(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={disabled || loading} onClick={addTitles}>
        {loading ? '⏳ Looking up title…' : `🏷️ Add video title${links.length > 1 ? 's' : ''}`}
      </Button>
      <span>Readers then see the title without loading anything. The lookup goes through a private mirror, never Google directly.</span>
      {failed && <span className="text-destructive">Couldn't find a title. You can type one after the link like 〔My title〕.</span>}
    </div>
  );
}
