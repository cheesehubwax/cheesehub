import type { LpToken } from '@/lib/lpPools';

export function waxterminalUrl(token: LpToken = { symbol: 'CHEESE', contract: 'cheeseburger' }): string {
  return `https://flopsterino.github.io/waxterminal/token/${token.symbol.toUpperCase()}@${token.contract}`;
}

/**
 * Small italic historical-data note used next to CHEESEAnal container headings.
 * Pass `token` to point the live-data link at that token's WAXTerminal page.
 */
export function HistoricalNote({ token }: { token?: LpToken }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] italic text-white whitespace-nowrap">
      <span>*</span>
      <span>This is not current or live data, consider it historical. For live data go</span>
      <a
        href={waxterminalUrl(token)}
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
