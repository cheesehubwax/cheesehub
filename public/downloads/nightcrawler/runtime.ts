/** Shared signing/resource safety only; importing this module never starts a runner. */
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { APIClient, FetchProvider, PrivateKey, Transaction, Action, ABI, Serializer } from '@wharfkit/antelope';
import { ROUTER, TOKEN, buildSend, dummyMemo, pickRecipient, refuseSend, buildPowerup, planPowerup, POWERUP_UNITS, parseBudget, sponsorRemaining, SPONSOR_PART_UNITS, SEND_COST_UNITS, utcDay, cheeseUnits, checkPermission, type Config, type Bot, type SendMode } from './policy';
import { writeJsonAtomic } from './nightState';
export const WAX_CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';
export const log = (m: string) => console.log(`${new Date().toISOString()}  ${m}`);
export const rand = () => randomInt(0, 2 ** 30) / 2 ** 30;

/** No retry or endpoint loop around signed writes; an uncertain submission stops the runner. */
export async function submitOnce(target: string, body: string, id: string): Promise<string> {
  const res = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, signal: AbortSignal.timeout(30_000) });
  const json = await res.json() as { transaction_id?: string; processed?: { receipt?: { status?: string } }; error?: unknown };
  if (!res.ok || json.error) throw new Error(`submission rejected or uncertain: HTTP ${res.status}; not retried`);
  if (json.transaction_id !== id || json.processed?.receipt?.status !== 'executed') throw new Error('submission not confirmed executed with matching transaction ID; not retried');
  return id;
}
export type RuntimeConfig = Pick<Config, 'bots' | 'chainApi' | 'broadcast' | 'reserve' | 'maxSendsPerBotPerDay'> & { sendMode?: SendMode };
export function createRuntime(config: RuntimeConfig, STATE_PATH: string, dryRun: boolean) {
  const mode = config.sendMode ?? 'standard';
  let preflightPassed = false;
  const bots = new Map<string, Bot & { key: PrivateKey }>();
  for (const b of config.bots) {
    try { bots.set(b.account, { ...b, key: PrivateKey.from(b.privateKey) }); }
    catch { throw new Error(`Config: ${b.account}: privateKey is not a valid key`); }
  }
  const botNames = [...bots.keys()];
  interface State { day: string; sent: Record<string, number>; bursts: number[]; powerups: Record<string, number> }
  let state: State = { day: utcDay(Date.now()), sent: {}, bursts: [], powerups: {} };
  if (existsSync(STATE_PATH)) {
    const s = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    if (typeof s?.day !== 'string' || !s.sent || typeof s.sent !== 'object' || Array.isArray(s.sent) || !Object.values(s.sent).every(v => Number.isSafeInteger(v) && Number(v) >= 0) || (s.bursts !== undefined && (!Array.isArray(s.bursts) || !s.bursts.every(Number.isFinite))) || (s.powerups !== undefined && (!s.powerups || typeof s.powerups !== 'object' || !Object.values(s.powerups).every(Number.isFinite)))) throw new Error('invalid runner state; refusing to reset counters');
    state = { day: s.day, sent: s.sent, bursts: s.bursts ?? [], powerups: s.powerups ?? {} };
  }
  const saveState = () => { if (!dryRun) writeJsonAtomic(STATE_PATH, state); };
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

/** Live sponsor budget; failure means not sponsored (free-only skips; standard may pay). */
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
  if (mode === 'free-only' && actionsJson.some(a => a.account !== ROUTER || (a as { name?: string }).name !== 'sendfree')) throw new Error('Nightcrawler permits only crypt.cheese::sendfree');
  const { tx, signature, url } = await withEndpoint(async (client, url) => {
    const info = await client.v1.chain.get_info();
    if (String(info.chain_id) !== WAX_CHAIN_ID) throw new Error('endpoint is not WAX mainnet');
    const actions = await Promise.all(actionsJson.map(async a => Action.from(a as never, await abiOf(client, a.account))));
    const tx = Transaction.from({ ...info.getTransactionHeader(120), actions });
    return { tx, signature: bot.key.signDigest(tx.signingDigest(info.chain_id)), url };
  });
  const id = String(tx.id);
  if (dryRun) { log(`DRY RUN ${label}: built and signed locally (${id.slice(0, 12)}…), not broadcast`); return id; }
  const body = JSON.stringify({ signatures: [String(signature)], compression: 0, packed_context_free_data: '', packed_trx: Serializer.encode({ object: tx }).hexString });
  const target = config.broadcast === 'direct' ? `${url}/v1/chain/send_transaction` : `${config.broadcast}/v1/chain/send_transaction`;
  return submitOnce(target, body, id);
}

// ---- One send at a time, never overlapping ----
let chain = Promise.resolve();
const serial = (fn: () => Promise<void>) => { chain = chain.then(fn, fn); return chain; };

async function send(senderName: string, why: string, fixedTo?: string) {
  await serial(async () => {
    if (!preflightPassed) throw new Error('permission preflight required before sending');
    rollDay();
    const bot = bots.get(senderName);
    if (!bot || !botNames.includes(fixedTo ?? botNames.find(n => n !== senderName) ?? '')) throw new Error('sender or recipient not configured');
    const to = fixedTo ?? pickRecipient(botNames, senderName, rand());
    try {
      if (!(await ensureCpu(senderName))) { if (mode !== 'free-only') log(`skip ${senderName} (${why}): CPU too low and no worker could power it up`); return; }
      const free = await freeAvailable();
      if (mode === 'free-only' && !free) { log(`skip ${senderName} (${why}): sponsor budget unavailable; no paid fallback`); return; }
      const refusal = refuseSend(state.sent[senderName] ?? 0, config.maxSendsPerBotPerDay, free ? 0 : await balanceUnits(senderName), cheeseUnits(config.reserve), free ? 0 : SEND_COST_UNITS);
      if (refusal) { log(`skip ${senderName} (${why}): ${refusal}`); return; }
      if (!dryRun) { state.sent[senderName] = (state.sent[senderName] ?? 0) + 1; saveState(); }
      const id = await broadcast(bot, to, free);
      log(`${why}: ${senderName} → ${to}  ${free ? 'free' : 'paid'}  tx ${id}`);
    } catch (e) {
      // Counted as used: an uncertain broadcast must never be repeated automatically.
      log(`FAILED ${senderName} (${why}): ${(e as Error).message} — not retried`);
      throw e;
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
  if (mode === 'free-only') {
    const available = await cpuAvailable(target);
    if (available === null || available < 500) { log(`skip ${target}: CPU low or unknown; rent CPU or stake WAX manually (no automatic powerups)`); return false; }
    return true;
  }
  const cpu: Record<string, number | null> = {};
  for (const n of botNames) cpu[n] = await cpuAvailable(n);
  const plan = planPowerup(target, cpu, state.powerups[target], Date.now());
  if (!plan) return !(cpu[target] != null && (cpu[target] as number) < 500);
  const payer = bots.get(plan.payer);
  if (!payer) return false;
  const refusal = refuseSend(0, 1, await balanceUnits(plan.payer).catch(() => NaN), cheeseUnits(config.reserve), POWERUP_UNITS);
  if (refusal) { log(`powerup for ${target} skipped: ${plan.payer} ${refusal}`); return (cpu[target] as number) >= 500; }
  // Recorded before broadcasting: an uncertain powerup is never repeated inside the cooldown.
  if (!dryRun) { state.powerups[target] = Date.now(); saveState(); }
  try {
    const id = await broadcastActions(payer, buildPowerup(plan.payer, payer.permission, target), `powerup ${plan.payer} → cheesepowerz for ${target} (0.0100 CHEESE)`);
    log(`powerup: ${plan.payer} paid 0.0100 CHEESE for ${target} (CPU ${cpu[target]} µs)  tx ${id}`);
    return true;
  } catch (e) { log(`powerup FAILED for ${target}: ${(e as Error).message} — not retried`); throw e; }
}

// ---- Safety check at start: dedicated, narrowly linked permission only ----
async function preflight() {
  preflightPassed = false;
  for (const bot of bots.values()) {
    const acc = await withEndpoint(c => c.v1.chain.get_account(bot.account));
    const problem = checkPermission(acc.toJSON() as never, bot.permission, [String(bot.key.toPublic())], mode);
    if (problem) throw new Error(`${bot.account}: ${problem}`);
    log(`ok ${bot.account}@${bot.permission}`);
  }
  preflightPassed = true;
}


  return { botNames, send, preflight, saveState, getState: () => state };
}
