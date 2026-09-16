import { OpenMojiIcon } from '@/components/OpenMojiIcon';

const WAXTERMINAL_URL = 'https://flopsterino.github.io/waxterminal/token/CHEESE@cheeseburger';

/**
 * Small italic historical-data note used next to CHEESEAnal container headings.
 * `withEmoji` shows the asterisk bullet without the full sentence (compact inline form).
 */
export function HistoricalNote({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] italic text-muted-foreground">
      <span>*</span>
      {compact ? (
        <span>historical data — see live</span>
      ) : (
        <span>This is not current or live data, consider it historical. For live data go</span>
      )}
      <a
        href={WAXTERMINAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cheese hover:underline"
      >
        here
      </a>
      {!compact && <span>.</span>}
    </span>
  );
}

// Keep OpenMojiIcon referenced for sections that want an emoji beside the note.
export const HistoricalNoteIcon = OpenMojiIcon;
