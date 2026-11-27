#!/usr/bin/env bun
/**
 * CHEESECrypt cover-traffic swarm — runs on YOUR machine with YOUR bot keys.
 * Nothing is hosted, relayed or uploaded. See README.md.
 *
 *   bun run run.ts swarm-config.json [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { APIClient, FetchProvider, PrivateKey, Transaction, Action, ABI, Serializer } from '@wharfkit/antelope';
import {
  ROUTER, TOKEN, validateConfig, buildSend, dummyMemo, poissonDelayMs, pickRecipient, planBurst, isOrganic,
  refuseSend, burstAllowed, buildPowerup, planPowerup, POWERUP_UNITS, parseBudget, sponsorRemaining, SPONSOR_PART_UNITS, SEND_COST_UNITS, utcDay, cheeseUnits, checkPermission, type Config, type Bot,
} from './policy';

const WAX_CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const configPath = args.find(a => !a.startsWith('--')) ?? 'swarm-config.json';
const STATE_PATH = configPath.replace(/\.json$/, '') + '.state.json';
const log = (m: string) => console.log(`${new Date().toISOString()}  ${m}`);
const rand = () => randomInt(0, 2 ** 30) / 2 ** 30;

if (!existsSync(configPath)) { console.error(`Config file not found: ${configPath}`); process.exit(1); }
let config: Config;
try { config = validateConfig(JSON.parse(readFileSync(configPath, 'utf8'))); } catch (e) { console.error((e as Error).message); process.exit(1); }
const bots = new Map<string, Bot & { key: PrivateKey }>();
for (const b of config.bots) {
  try { bots.set(b.account, { ...b, key: PrivateKey.from(b.privateKey) }); }
  catch { console.error(`Config: ${b.account}: privateKey is not a valid key`); process.exit(1); }
}
const botNames = [...bots.keys()];
const botSet = new Set(botNames);

// ---- Counts only (never keys) so a restart cannot reset daily caps ----
interface State { day: string; sent: Record<string, number>; bursts: number[]; powerups: Record<string, number> }
let state: State = { day: utcDay(Date.now()), sent: {}, bursts: [], powerups: {} };
try { const s = JSON.parse(readFileSync(STATE_PATH, 'utf8')); if (s?.day) state = { day: s.day, sent: s.sent ?? {}, bursts: s.bursts ?? [], powerups: s.powerups ?? {} }; } catch { /* fresh */ }
const saveState = () => { try { writeFileSync(STATE_PATH, JSON.stringify(state)); } catch { /* non-fatal */ } };
const rollDay = () => { const d = utcDay(Date.now()); if (d !== state.day) state = { day: d, sent: {}, bursts: state.bursts, powerups: state.powerups }; };

// ---- Chain access (reads direct: public chain metadata; signed broadcast follows the config) ----
async function withEndpoint<T>(fn: (c: APIClient, url: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const url of config.chainApi) {
    try { return await fn(new APIClient({ provider: new FetchProvider(url, { fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(12_000) }) }) }), url); }
    catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error('all chain endpoints failed');
}
const abiCache = new Map<string, ABI>();
async function abiOf(client: APIClient, contract: string) {
  let a = abiCache.get(contract);
  if (!a) { const r = await client.v1.chain.get_abi(contract); if (!r.abi) throw new Error(`no ABI for ${contract}`); a = ABI.from(r.abi); abiCache.set(contract, a); }
  return a;
}
async function balanceUnits(account: string): Promise<number> {
  const rows = await withEndpoint(c => c.v1.chain.get_currency_balance(TOKEN, account, 'CHEESE'));
  return rows.length ? cheeseUnits(String(rows[0])) : 0;
}

/** Live sponsor budget; any read failure means "not sponsored", so the send stays on the paid route. */
async function freeAvailable(): Promise<boolean> {
  try {
    const r = await withEndpoint(c => c.v1.chain.get_table_rows({ code: ROUTER, scope: ROUTER, table: 'budget', limit: 1, json: true } as never));
    return sponsorRemaining(parseBudget((r as { rows?: unknown[] }).rows?.[0]), Math.floor(Date.now() / 1000)) >= SPONSOR_PART_UNITS;
  } catch { return false; }
}

/** One attempt, never retried: an ambiguous result could mean the transaction still lands. */
async function broadcast(bot: Bot & { key: PrivateKey }, to: string, free: boolean): Promise<string> {
  const memo = dummyMemo(n => new Uint8Array(randomBytes(n)));
  return broadcastActions(bot, buildSend(bot.account, bot.permission, to, memo, free), `${bot.account} → ${to}: ${free ? 'sendfree' : 'paid sendmsg'}`);
}
async function broadcastActions(bot: Bot & { key: PrivateKey }, actionsJson: { account: string }[], label: string): Promise<string> {
  return withEndpoint(async (client, url) => {
    const info = await client.v1.chain.get_info();
    if (String(info.chain_id) !== WAX_CHAIN_ID) throw new Error('endpoint is not WAX mainnet');
    const actions = await Promise.all(actionsJson.map(async a => Action.from(a as never, await abiOf(client, a.account))));
    const tx = Transaction.from({ ...info.getTransactionHeader(120), actions });
    const signature = bot.key.signDigest(tx.signingDigest(info.chain_id));
    const id = String(tx.id);
    if (dryRun) { log(`DRY RUN ${label}: built and signed locally (${id.slice(0, 12)}…), not broadcast`); return id; }
    const body = JSON.stringify({ signatures: [String(signature)], compression: 0, packed_context_free_data: '', packed_trx: Serializer.encode({ object: tx }).hexString });
    const target = config.broadcast === 'direct' ? `${url}/v1/chain/send_transaction` : `${config.broadcast}/v1/chain/send_transaction`;
    const res = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, signal: AbortSignal.timeout(30_000) });
    const json = await res.json().catch(() => ({})) as { transaction_id?: string; error?: unknown };
    if (!res.ok || json.error) throw new Error(`rejected: HTTP ${res.status}`);
    if (json.transaction_id && json.transaction_id !== id) throw new Error('transaction id mismatch');
    return id;
  });
}

// ---- One send at a time, never overlapping ----
let chain = Promise.resolve();
const serial = (fn: () => Promise<void>) => { chain = chain.then(fn, fn); return chain; };

async function send(senderName: string, why: string) {
  await serial(async () => {
    rollDay();
    const bot = bots.get(senderName)!;
    const to = pickRecipient(botNames, senderName, rand());
    try {
      if (!(await ensureCpu(senderName))) { log(`skip ${senderName} (${why}): CPU too low and no bot could power it up`); return; }
      const free = await freeAvailable();
      const refusal = refuseSend(state.sent[senderName] ?? 0, config.maxSendsPerBotPerDay, free ? 0 : await balanceUnits(senderName), cheeseUnits(config.reserve), free ? 0 : SEND_COST_UNITS);
      if (refusal) { log(`skip ${senderName} (${why}): ${refusal}`); return; }
      const id = await broadcast(bot, to, free);
      state.sent[senderName] = (state.sent[senderName] ?? 0) + 1; saveState();
      log(`${why}: ${senderName} → ${to}  ${free ? 'free' : 'paid'}  tx ${id}`);
    } catch (e) {
      // Counted as used: an uncertain broadcast must never be repeated automatically.
      state.sent[senderName] = (state.sent[senderName] ?? 0) + 1; saveState();
      log(`FAILED ${senderName} (${why}): ${(e as Error).message} — not retried`);
    }
  });
}

// ---- Auto-powerup: 0.0100 CHEESE to cheesepowerz before a bot runs dry (staked CPU stays the main source) ----
async function cpuAvailable(account: string): Promise<number | null> {
  try { const a = await withEndpoint(c => c.v1.chain.get_account(account)); const v = Number(String(a.cpu_limit.available)); return Number.isFinite(v) ? v : null; }
  catch { return null; }
}
/** False only when the bot is too low to send and nobody could top it up. */
async function ensureCpu(target: string): Promise<boolean> {
  const cpu: Record<string, number | null> = {};
  for (const n of botNames) cpu[n] = await cpuAvailable(n);
  const plan = planPowerup(target, cpu, state.powerups[target], Date.now());
  if (!plan) return !(cpu[target] != null && (cpu[target] as number) < 500);
  const payer = bots.get(plan.payer)!;
  const refusal = refuseSend(0, 1, await balanceUnits(plan.payer).catch(() => NaN), cheeseUnits(config.reserve), POWERUP_UNITS);
  if (refusal) { log(`powerup for ${target} skipped: ${plan.payer} ${refusal}`); return (cpu[target] as number) >= 500; }
  // Recorded before broadcasting: an uncertain powerup is never repeated inside the cooldown.
  if (!dryRun) { state.powerups[target] = Date.now(); saveState(); }
  try {
    const id = await broadcastActions(payer, buildPowerup(plan.payer, payer.permission, target), `powerup ${plan.payer} → cheesepowerz for ${target} (0.0100 CHEESE)`);
    log(`powerup: ${plan.payer} paid 0.0100 CHEESE for ${target} (CPU ${cpu[target]} µs)  tx ${id}`);
    return true;
  } catch (e) { log(`powerup FAILED for ${target}: ${(e as Error).message} — not retried`); return false; }
}

// ---- Safety check at start: dedicated, narrowly linked permission only ----
async function preflight() {
  for (const bot of bots.values()) {
    const acc = await withEndpoint(c => c.v1.chain.get_account(bot.account));
    const problem = checkPermission(acc.toJSON() as never, bot.permission, [String(bot.key.toPublic())]);
    if (problem) throw new Error(`${bot.account}: ${problem}`);
    log(`ok ${bot.account}@${bot.permission}`);
  }
}

// ---- Poisson trickle: each bot has its own independent timer ----
function trickle(name: string) {
  const next = () => {
    const ms = poissonDelayMs(config.trickleRatePerHour, rand());
    if (!Number.isFinite(ms)) return;
    setTimeout(() => { void send(name, 'trickle'); next(); }, ms);
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
      state.bursts = state.bursts.filter(t => now - t < 3_600_000);
      if (burstAllowed(state.bursts, now, config.maxBurstsPerHour)) {
        state.bursts.push(now); saveState();
        const plan = planBurst(config, rand);
        log(`burst: ${triggers} organic send(s) seen; ${plan.length} bot(s) will answer`);
        for (const p of plan) setTimeout(() => void send(p.sender, 'burst'), p.delayMs);
      } else log(`burst skipped: ${config.maxBurstsPerHour}/hour limit`);
    }
  } catch (e) { log(`watch error: ${(e as Error).message}`); }
}

async function main() {
  log(`CHEESECrypt swarm starting${dryRun ? ' (DRY RUN: nothing is broadcast)' : ''}: ${botNames.length} bots, broadcast ${config.broadcast === 'direct' ? 'DIRECT (not via Tor)' : config.broadcast}`);
  if (config.broadcast === 'direct') log('note: direct mode shows your IP to the nodes. Use the Tor helper for network privacy.');
  await preflight();
  for (const n of botNames) trickle(n);
  if (config.maxBurstsPerHour > 0 && config.burstMax > 0) { await watch(); setInterval(() => void watch(), 15_000); }
  process.on('SIGINT', () => { log('stopping'); saveState(); process.exit(0); });
  await new Promise(() => {});
}
main().catch(e => { console.error(`Stopped: ${(e as Error).message}`); process.exit(1); });
