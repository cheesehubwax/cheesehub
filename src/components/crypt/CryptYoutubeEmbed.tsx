import { useState } from 'react';
import { getAudioPlayer } from '@/lib/audioPlayer';
import { announcePlaying } from '@/lib/cryptAudio';
import { embedUrl, type YoutubeLink, type YoutubeTier } from '@/lib/cryptYoutube';

const LABEL: Record<YoutubeTier, string> = { invidious: '🛡️ Invidious', piped: '🛡️ Piped', direct: '⚡ YouTube direct' };

/**
 * Click-to-play YouTube card. Nothing loads until play is pressed. Invidious first, Piped second,
 * direct YouTube only after the reader confirms the IP warning.
 */
export function CryptYoutubeEmbed({ link }: { link: YoutubeLink }) {
  const [tier, setTier] = useState<YoutubeTier | null>(null);
  const [warn, setWarn] = useState(false);
  const play = (t: YoutubeTier) => {
    getAudioPlayer().pause(); announcePlaying('crypt-youtube');
    setWarn(false); setTier(t);
  };
  return (
    <div className="my-1 w-72 max-w-full rounded-md border border-border bg-background/60 p-1" onContextMenu={e => e.stopPropagation()}>
      {tier ? (
        <iframe key={tier} src={embedUrl(link, tier)} title={`YouTube video ${link.id}`} className="aspect-video w-full rounded"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
      ) : (
        <button type="button" onClick={() => play('invidious')} aria-label="Play video privately"
          className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded bg-muted hover:bg-muted/70">
          <span className="text-3xl" aria-hidden>▶️</span>
          <span className="text-xs font-semibold">YouTube video</span>
          <span className="text-[10px] text-muted-foreground">Plays privately via Invidious</span>
        </button>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
        {tier && <span className="text-muted-foreground">Playing via {LABEL[tier]}</span>}
        {tier === 'invidious' && <button type="button" className="font-semibold text-cheese underline" onClick={() => play('piped')}>Not loading? Try Piped</button>}
        {tier !== 'direct' && !warn && <button type="button" className="font-semibold text-muted-foreground underline" onClick={() => setWarn(true)}>Play directly</button>}
      </div>
      {warn && (
        <div role="alert" className="mt-1 rounded border border-destructive/50 bg-destructive/10 p-2 text-[11px]">
          <p className="font-semibold text-destructive">⚠️ Playing directly shares your IP address with Google.</p>
          <p className="text-muted-foreground">Invidious and Piped hide it. Only continue if both private players fail.</p>
          <div className="mt-1 flex gap-2">
            <button type="button" className="font-semibold text-destructive underline" onClick={() => play('direct')}>Play on YouTube anyway</button>
            <button type="button" className="underline" onClick={() => setWarn(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
