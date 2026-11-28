#!/usr/bin/env bun
/** Daytime synthetic traffic only. Nightcrawler starts independently with night.ts. */
import { readFileSync, existsSync } from 'node:fs';
import { ROUTER, validateConfig, poissonDelayMs, planBurst, isOrganic, burstAllowed } from './policy';
import { createRuntime, log, rand } from './runtime';
import { acquireRunnerControl } from './runnerControl';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const configPath = args.find(a => !a.startsWith('--')) ?? (existsSync('config.json') || !existsSync('swarm-config.json') ? 'config.json' : 'swarm-config.json');
async function main() {
  const config = validateConfig(JSON.parse(readFileSync(configPath, 'utf8')));
  const control = acquireRunnerControl(configPath);
  process.on('exit', () => control.release());
  const runtime = createRuntime(config, configPath.replace(/\.json$/, '') + '.state.json', dryRun);
  const { botNames, send, preflight, saveState } = runtime;
  const botSet = new Set(botNames);
  let stopping = false;
  let exitCode = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const pending = new Set<Promise<unknown>>();
  let finish: (() => void) | undefined;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const shutdown = async (error?: unknown) => {
    if (error) { exitCode = 1; console.error('Stopped: runner operation failed — inspect the log before restarting'); }
    if (stopping) return;
    stopping = true;
    log('stopping: cancelling timers and waiting for in-flight operations; no transaction retries');
    timers.forEach(clearTimeout); timers.clear();
    clearInterval(stopPoll);
    while (pending.size) await Promise.allSettled([...pending]);
    try { saveState(); control.release(); log('stopped'); }
    catch { exitCode = 1; console.error('Shutdown persistence failed; inspect counters and lock before restarting'); }
    process.exitCode = exitCode; finish?.();
  };
  const track = (job: Promise<unknown>) => {
    pending.add(job);
    void job.then(() => pending.delete(job), error => { pending.delete(job); void shutdown(error); });
    return job;
  };
  const later = (fn: () => void, ms: number) => {
    if (stopping) return;
    const timer = setTimeout(() => { timers.delete(timer); if (!stopping) fn(); }, ms);
    timers.add(timer);
  };
  const stopPoll = setInterval(() => {
    try { if (control.stopRequested()) void shutdown(); }
    catch (error) { void shutdown(error); }
  }, 500);
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
// ---- Poisson trickle: each bot has its own independent timer ----
function trickle(name: string) {
  const next = () => {
    const ms = poissonDelayMs(config.trickleRatePerHour, rand());
    if (!Number.isFinite(ms)) return;
    later(() => { track(send(name, 'trickle')); next(); }, ms);
  };
  next();
}

// ---- Reactive bursts: watch the shared crypt.cheese stream for other people's sends ----
let cursor = new Date(Date.now() - 30_000).toISOString();
const seen = new Set<string>();
async function history(path: string): Promise<{ actions?: { trx_id: string; '@timestamp': string; act: never }[] }> {
  const bases = config.historyViaHelper ? [config.historyViaHelper] : config.hyperion;
  let last: unknown;
  for (const base of bases) {
    try { const r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20_000) }); if (r.ok) return await r.json() as never; last = new Error(`HTTP ${r.status}`); }
    catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error('history unavailable');
}
async function watch() {
  try {
    const q = `/v2/history/get_actions?account=${ROUTER}&filter=${ROUTER}:sendmsg,${ROUTER}:sendfree&sort=asc&limit=100&after=${encodeURIComponent(cursor)}`;
    const { actions = [] } = await history(q);
    if (stopping) return;
    let triggers = 0;
    for (const a of actions) {
      if (seen.has(a.trx_id)) continue;
      seen.add(a.trx_id);
      if (a['@timestamp'] > cursor) cursor = a['@timestamp'];
      if (isOrganic(a as never, botSet)) triggers++;
    }
    if (seen.size > 5000) { const keep = [...seen].slice(-1000); seen.clear(); keep.forEach(x => seen.add(x)); }
    if (triggers) {
      const now = Date.now();
      const state = runtime.getState();
      state.bursts = state.bursts.filter(t => now - t < 3_600_000);
      if (burstAllowed(state.bursts, now, config.maxBurstsPerHour)) {
        state.bursts.push(now); saveState();
        const plan = planBurst(config, rand);
        log(`batch: ${triggers} external send(s) seen; ${plan.length} worker(s) scheduled`);
        for (const p of plan) later(() => { track(send(p.sender, 'batch')); }, p.delayMs);
      } else log(`batch skipped: ${config.maxBurstsPerHour}/hour limit`);
    }
  } catch (e) { log(`watch error: ${(e as Error).message}`); }
}


  log(`CHEESECrypt synthetic test starting${dryRun ? ' (DRY RUN: nothing is broadcast)' : ''}: ${botNames.length} workers, broadcast ${config.broadcast}`);
  if (config.broadcast === 'direct') log('note: direct mode shows your IP to the nodes.');
  try { await track(preflight()); } catch { await finished; return; }
  if (stopping) { await finished; return; }
  for (const n of botNames) trickle(n);
  if (config.maxBurstsPerHour > 0 && config.burstMax > 0) {
    const watchNext = async () => { await track(watch()); later(() => { void watchNext(); }, 15_000); };
    await watchNext();
  }
  await finished;
}
main().catch(() => { console.error('Stopped: startup failed — check config, permissions and runner lock before restarting'); process.exit(1); });
