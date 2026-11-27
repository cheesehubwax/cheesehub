#!/usr/bin/env bun
/** Opt-in local Nightcrawler. No daytime runner is imported or started. */
import { readFileSync } from 'node:fs';
import { validateNightRunnerConfig, upcomingNightKey, planNight } from './policy';
import { createNightScheduler, lockRunner, nightFingerprint, readNightState, type NightState } from './nightState';
import { createRuntime, log, rand } from './runtime';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const configPath = args.find(a => !a.startsWith('--')) ?? 'night-config.json';
let unlock: (() => void) | undefined;
const stop = (e: unknown) => {
  unlock?.();
  console.error(`Nightcrawler stopped: ${e instanceof Error ? e.message : 'runner failed'} — inspect before restarting`);
  process.exit(1);
};
async function main() {
  const c = validateNightRunnerConfig(JSON.parse(readFileSync(configPath, 'utf8')));
  if (!c.night.enabled) { log('Nightcrawler disabled; no connections or sends started'); return; }
  const base = configPath.replace(/\.json$/, '');
  if (!dryRun) unlock = lockRunner(`${base}.night.json`);
  const runtime = createRuntime({ bots: c.accounts, maxSendsPerBotPerDay: c.maxSendsPerAccountPerDay, reserve: c.reserve, chainApi: c.chainApi, broadcast: c.broadcast }, `${base}.state.json`, dryRun);
  const printPlan = (s: NightState) => {
    log(`night ${s.key}: ${s.plan.length} scheduled sample send(s)`);
    for (const e of s.plan) log(`${new Date(e.atMs).toLocaleString('en-GB', { timeZone: c.night.timezone, hour12: false })} ${e.sender} → ${e.recipient}`);
  };
  log(`Nightcrawler${dryRun ? ' DRY RUN (no broadcasts or progress writes)' : ''}: ${c.night.timezone}, ${c.night.start}–${c.night.end}, ${c.accounts.length} private accounts`);
  if (c.broadcast === 'direct') log('warning: direct mode exposes your IP to chain nodes; public preparation reads also remain direct');
  else log('note: signed sends use the helper; public account/preparation reads still go to chainApi nodes');
  await runtime.preflight();
  if (dryRun) {
    const key = upcomingNightKey(Date.now(), c.night);
    printPlan({ fingerprint: nightFingerprint(c.night, runtime.botNames), key, plan: planNight(c.night, runtime.botNames, key, rand), done: [] });
    const sender = runtime.botNames[0];
    const recipient = runtime.botNames[1];
    if (sender && recipient) await runtime.send(sender, 'dry-run safety sample', recipient);
    return;
  }
  const { writeJsonAtomic } = await import('./nightState');
  const scheduler = createNightScheduler({
    night: c.night, accounts: runtime.botNames,
    state: readNightState(`${base}.night.json`, nightFingerprint(c.night, runtime.botNames), runtime.botNames, c.night),
    now: Date.now, rand, persist: s => writeJsonAtomic(`${base}.night.json`, s),
    send: (sender, recipient) => runtime.send(sender, 'night', recipient), onPlan: printPlan,
  });
  const close = () => { unlock?.(); log('Nightcrawler stopped'); process.exit(0); };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  await scheduler.tick();
  setInterval(() => void scheduler.tick().catch(stop), 20_000);
}
main().catch(stop);