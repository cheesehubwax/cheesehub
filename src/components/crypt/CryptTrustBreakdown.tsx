import { CryptRespectMark } from './CryptRespectMark';
import { MAX_TOTAL_POINTS, TRUST_DISCLAIMER, type TrustScore } from '@/lib/cryptTrust';

/** Per-signal breakdown of a Respect score (shown only for your own account). Presentational only. */
export function CryptTrustBreakdown({ account, score }: { account: string; score: TrustScore | null }) {
  return <div className="space-y-2 text-xs">
    <p className="font-semibold">Your Respect <span className="font-mono">({account})</span></p>
    {!score ? <p className="text-muted-foreground">Loading public signals…</p> : <>
      <p><span className="font-semibold"><CryptRespectMark mark={score.mark} /></span> · {score.total}/{MAX_TOTAL_POINTS} points{score.partial && <span className="text-muted-foreground"> (partial: some signals couldn’t be read)</span>}</p>
      <ul className="space-y-1">
        {score.lines.map(l => <li key={l.id} className="flex items-baseline justify-between gap-2">
          <span className="min-w-0"><span>{l.label}</span> <span className="text-muted-foreground">{l.detail}</span></span>
          <span className="shrink-0 font-mono">{l.points == null ? `?/${l.max}` : `${l.points}/${l.max}`}</span>
        </li>)}
      </ul>
    </>}
    <p className="border-t border-border pt-2 text-[10px] text-muted-foreground">{TRUST_DISCLAIMER}</p>
  </div>;
}
