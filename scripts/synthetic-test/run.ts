#!/usr/bin/env bun
/** Daytime synthetic traffic only. Nightcrawler starts independently with night.ts. */
import { readFileSync, existsSync } from 'node:fs';
import { ROUTER, validateConfig, poissonDelayMs, planBurst, isOrganic, burstAllowed } from './policy';
import { createRuntime, log, rand } from './runtime';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const configPath = args.find(a => !a.startsWith('--')) ?? (existsSync('config.json') || !existsSync('swarm-config.json') ? 'config.json' : 'swarm-config.json');
const stop = (e: unknown) => { console.error(`Stopped: ${e instanceof Error ? e.message : 'runner failed'} — inspect before restarting`); process.exit(1); };
async function main() {
  const config = validateConfig(JSON.parse(readFileSync(configPath, 'utf8')));
  const runtime = createRuntime(config, configPath.replace(/\.json$/, '') + '.state.json', dryRun);
  const { botNames, send, preflight, saveState } = runtime;
  const botSet = new Set(botNames);
// ---- Poisson trickle: each bot has its own independent timer ----
function trickle(name: string) {
  const next = () => {
    const ms = poissonDelayMs(config.trickleRatePerHour, rand());
    if (!Number.isFinite(ms)) return;
    setTimeout(() => { void send(name, 'trickle').catch(stop); next(); }, ms);
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
        for (const p of plan) setTimeout(() => void send(p.sender, 'batch').catch(stop), p.delayMs);
      } else log(`batch skipped: ${config.maxBurstsPerHour}/hour limit`);
    }
  } catch (e) { log(`watch error: ${(e as Error).message}`); }
}


  log(`CHEESECrypt synthetic test starting${dryRun ? ' (DRY RUN: nothing is broadcast)' : ''}: ${botNames.length} workers, broadcast ${config.broadcast}`);
  if (config.broadcast === 'direct') log('note: direct mode shows your IP to the nodes.');
  await preflight();
  for (const n of botNames) trickle(n);
  if (config.maxBurstsPerHour > 0 && config.burstMax > 0) { await watch(); setInterval(() => void watch(), 15_000); }
  process.on('SIGINT', () => { log('stopping'); saveState(); process.exit(0); });
  await new Promise(() => {});
}
main().catch(stop);
