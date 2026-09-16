const WAXTERMINAL_URL = 'https://flopsterino.github.io/waxterminal/token/CHEESE@cheeseburger';

/**
 * Small italic historical-data note used next to CHEESEAnal container headings.
 */
export function HistoricalNote() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] italic text-muted-foreground whitespace-nowrap">
      <span>*</span>
      <span>This is not current or live data, consider it historical. For live data go</span>
      <a
        href={WAXTERMINAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cheese hover:underline"
      >
        here
      </a>
      <span>.</span>
    </span>
  );
}
