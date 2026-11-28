#!/usr/bin/env node
// CHEESECrypt Tor helper — open source, no dependencies, runs only on your own computer.
//
// What it does: listens on http://127.0.0.1:8088 and forwards WAX history reads
// (GET /v2/history/... and /v2/health) plus already-signed transaction broadcasts
// (POST /v1/chain/send_transaction or push_transaction) through your local Tor client.
// v1.3 also forwards chat NFT lookups (GET /atomic/v1/assets/<id>) and NFT pictures,
// sounds and videos (GET /ipfs/<cid>) so AtomicAssets and IPFS gateways never see you.
// v1.4 also forwards the read-only lookups behind Respect badges (account age, CHEESE
// balance, staked CHEESE, Alcor pool positions and CHEESE NFT count) so the public WAX,
// AtomicAssets and Alcor servers never learn which accounts you are looking at.
// v1.5 gives each kind of traffic its own Tor circuit (Tor's IsolateSOCKSAuth, on by
// default): every Respect lookup and every broadcast gets a brand-new circuit, history
// reads keep one steady circuit, and NFT media spreads over four circuits. Read-only
// Respect and NFT lookups also rotate between servers, so no single server or exit sees
// a decoy and the real lookup beside each other. History stays on one server (servers
// index history differently) and a broadcast still goes to ONE server, never retried.
// v1.6 also forwards the read-only lookups a wallet makes while preparing a transaction
// (chain info, block headers, ABIs, required keys) and the wallet NFT list used by the
// avatar and attach-NFT pickers, each on a fresh circuit with rotating servers.
// v1.7 adds resilience: more vetted WAX and NFT servers, a server that rate-limits (429),
// is overloaded (5xx) or times out sits out for a short while and is tried last, NFT media
// moves on when a gateway sends nothing for 15 seconds, and server health is refreshed
// through Tor every 10 minutes instead of only at startup. Broadcasts are still ONE try.
// Those public servers see a Tor exit address instead of your home IP.
//
// What it does NOT do: it is not a Tor relay or exit node, it never accepts connections
// from other computers, it never signs or changes transactions, and it writes no traffic
// logs or files. Media is passed through in memory only (never saved to disk). A broadcast is attempted on ONE upstream only, never retried: a lost
// reply does not prove the chain rejected it. Check the account before manually retrying.
//
// Run:  node cheesecrypt-tor-proxy-v1.7.mjs
// Then in CHEESECrypt → Menu → Privacy → "Your own history server" enter http://localhost:8088
// Tick "Use only this server" to route CHEESECrypt's signed broadcasts here too.
//
// Needs Node.js 18+ and Tor running (Tor Browser open = port 9150, Tor service = port 9050).

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const LISTEN_PORT = Number(process.env.PORT || 8088);
const TOR_PORTS = [9150, 9050];
const UPSTREAMS = [
  'https://api.waxsweden.org',
  'https://wax.eosphere.io',
  'https://wax.eosdac.io',
  'https://wax.eosusa.io',
];
// Read-only chain lookups (v1.7) may also use these proven chain-API servers; history stays on UPSTREAMS.
const CHAIN_UPSTREAMS = [...UPSTREAMS, 'https://wax.greymass.com', 'https://api.wax.alohaeos.com'];
const ATOMIC_UPSTREAMS = [
  'https://wax.api.atomicassets.io',
  'https://aa.wax.blacklusion.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://atomic.wax.eosrio.io',
  'https://wax-atomic-api.eosphere.io',
];
const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io',
  'https://dweb.link',
  'https://nftstorage.link',
  'https://ipfs.io',
];
const ALCOR_UPSTREAMS = ['https://wax.alcor.exchange'];
export const HELPER_VERSION = '1.7';
export const MEDIA_LANES = 4;
// Circuit labels are random per helper run and never leave this computer except as the
// SOCKS username/password Tor uses to keep circuits apart.
const SESSION = randomBytes(6).toString('hex');
let mediaLane = 0;
/** Tor circuit label: 'history' is steady, 'media' cycles four lanes, anything else is fresh each time. */
export function isolationFor(kind) {
  if (kind === 'history') return `cc-${SESSION}-history`;
  if (kind === 'media') return `cc-${SESSION}-media-${mediaLane++ % MEDIA_LANES}`;
  return `cc-${SESSION}-${kind}-${randomBytes(8).toString('hex')}`;
}
/** Start each read-only lookup on the next server in turn; failures still fall through the rest. */
export function rotate(list, counter) {
  if (list.length < 2) return [...list];
  const i = counter % list.length;
  return [...list.slice(i), ...list.slice(0, i)];
}
export const TIMEOUT_MS = 8000;
export const MEDIA_TIMEOUT_MS = 45000;
/** Media gateways that send no reply headers within this time are skipped (v1.7). */
export const MEDIA_HEADER_TIMEOUT_MS = 15000;
/** How long a failing server sits out (v1.7); it stays as a last resort, never removed. */
export const BENCH_MS = { rateLimited: 60000, overloaded: 30000, network: 30000 };
export const HEALTH_REFRESH_MS = 10 * 60 * 1000;
const benched = new Map();
/** Sit a server out after a 429, a 5xx or a network failure/timeout. */
export function benchFor(upstream, error) {
  const m = /HTTP (\d{3})/.exec(String(error?.message || ''));
  const code = m ? Number(m[1]) : 0;
  const ms = code === 429 || code === 420 ? BENCH_MS.rateLimited : code >= 500 ? BENCH_MS.overloaded : code ? 0 : BENCH_MS.network;
  if (ms) benched.set(upstream, Date.now() + ms);
}
export function clearBench() { benched.clear(); }
/** Same order, but servers sitting out move to the back (still tried if everything else fails). */
export function preferReady(list, now = Date.now()) {
  const out = (u) => (benched.get(u) || 0) > now;
  return [...list.filter(u => !out(u)), ...list.filter(out)];
}
export const MAX_MEDIA = 50 * 1024 * 1024;
const ATOMIC_PATH = /^\/atomic\/v1\/assets\/(\d{1,20})$/;
// Respect lookups: exact read-only shapes, WAX account names only.
const ATOMIC_ACCOUNT_PATH = /^\/atomic\/v1\/accounts\/([a-z1-5.]{1,13})(\?collection_whitelist=[a-z1-5.]{1,13})?$/;
const ALCOR_POSITIONS_PATH = /^\/alcor\/v2\/account\/([a-z1-5.]{1,13})\/positions$/;
const CHAIN_READ_PATH = /^\/v1\/chain\/(get_account|get_currency_balance|get_table_rows|get_info|get_block|get_block_info|get_block_header_state|get_abi|get_raw_abi|get_raw_code_and_abi|get_required_keys|get_table_by_scope|get_currency_stats)$/;
// Wallet NFT list (v1.6): exact query shape only, newest transfers first.
const ATOMIC_LIST_PATH = /^\/atomic\/v1\/assets\?owner=([a-z1-5.]{1,13})&page=([1-9]\d?)&limit=(100|[1-9]\d?)&order=desc&sort=transferred$/;
const MAX_READ_BODY = 16 * 1024;
// CIDv0 (Qm…) or base32 CIDv1 (b…), optional folder sub-path; no dot segments, no query.
const IPFS_PATH = /^\/ipfs\/((?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(?:\/[A-Za-z0-9._~%-]+)*)$/;
const MEDIA_TYPE = /^(image|audio|video)\/[a-z0-9.+-]+$|^application\/octet-stream$/i;
export function mediaPathAllowed(url) {
  const m = IPFS_PATH.exec(url || '');
  return !!m && !m[1].split('/').some(s => s === '.' || s === '..' || /%2f|%5c|%2e/i.test(s));
}
export const BROADCAST_TIMEOUT_MS = 12000;
const MAX_BODY = 20 * 1024 * 1024;
const MAX_REQUEST_BODY = 1024 * 1024;
const ALLOWED_PATH = /^\/v2\/(history\/[a-z_]+|health)(\?|$)/;
const BROADCAST_PATH = /^\/v1\/chain\/(send_transaction|push_transaction)$/;

/** Open a TCP tunnel to host:port through Tor's SOCKS5 port (host resolved by Tor, never locally). */
function socksConnect(torPort, host, port, isolation) {
  return new Promise((resolve, reject) => {
    const s = net.connect(torPort, '127.0.0.1');
    let stage = 0, buf = Buffer.alloc(0);
    const fail = (e) => { s.destroy(); reject(e instanceof Error ? e : new Error(String(e))); };
    s.setTimeout(TIMEOUT_MS, () => fail('Tor connection timed out'));
    s.on('error', fail);
    // With a label, offer username/password so Tor puts this stream on that label's circuit.
    const label = isolation ? Buffer.from(String(isolation).slice(0, 255)) : null;
    const sendConnect = () => {
      stage = 1;
      const h = Buffer.from(host);
      s.write(Buffer.concat([Buffer.from([5, 1, 0, 3, h.length]), h, Buffer.from([port >> 8, port & 255])]));
    };
    s.on('connect', () => s.write(Buffer.from(label ? [5, 2, 0, 2] : [5, 1, 0])));
    s.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (stage === 0) {
        if (buf.length < 2) return;
        if (buf[0] !== 5) return fail('Tor refused the handshake');
        if (buf[1] === 2 && label) {
          buf = buf.subarray(2); stage = 3;
          s.write(Buffer.concat([Buffer.from([1, label.length]), label, Buffer.from([label.length]), label]));
        } else if (buf[1] === 0) { buf = buf.subarray(2); sendConnect(); }
        else return fail('Tor refused the handshake');
      }
      if (stage === 3) {
        if (buf.length < 2) return;
        if (buf[0] !== 1 || buf[1] !== 0) return fail('Tor refused the circuit label');
        buf = buf.subarray(2); sendConnect();
      }
      if (stage === 1) {
        if (buf.length < 5) return;
        if (buf[1] !== 0) return fail(`Tor could not reach ${host} (code ${buf[1]})`);
        const len = buf[3] === 1 ? 10 : buf[3] === 4 ? 22 : 7 + buf[4];
        if (buf.length < len) return;
        s.removeAllListeners('data'); s.removeListener('error', fail); s.setTimeout(0);
        if (buf.length > len) s.unshift(buf.subarray(len));
        stage = 2; resolve(s);
      }
    });
  });
}

let torPortInUse = null;
async function findTor(ports = TOR_PORTS) {
  const candidates = torPortInUse && ports.includes(torPortInUse)
    ? [torPortInUse, ...ports.filter(p => p !== torPortInUse)]
    : ports;
  for (const p of candidates) {
    const ok = await new Promise((r) => {
      const s = net.connect(p, '127.0.0.1');
      s.setTimeout(1000, () => { s.destroy(); r(false); });
      s.on('connect', () => { s.destroy(); r(true); });
      s.on('error', () => r(false));
    });
    if (ok) return (torPortInUse = p);
  }
  return null;
}

/**
 * One HTTPS request through Tor. Complete JSON responses, including nodeos errors,
 * are returned to the caller; network failures and malformed JSON are rejected.
 * The dedicated Agent cannot open a direct/DNS connection.
 */
export function requestViaTor(torPort, upstream, path, { method = 'GET', body, contentType = 'text/plain;charset=UTF-8', timeoutMs = TIMEOUT_MS, headerTimeoutMs = 0, ca, media = false, isolation } = {}) {
  const base = new URL(upstream);
  const u = new URL(path, base);
  if (u.protocol !== 'https:' || u.origin !== base.origin) return Promise.reject(new Error('upstream must stay on the original HTTPS server'));
  const payload = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return new Promise((resolve, reject) => {
    let raw, sock, req, agent, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true; clearTimeout(timer); if (headerTimer) clearTimeout(headerTimer);
      req?.destroy(); sock?.destroy(); raw?.destroy(); agent?.destroy();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('timed out')), timeoutMs);
    // Media: a gateway that has not even started replying is skipped early (v1.7).
    const headerTimer = headerTimeoutMs ? setTimeout(() => finish(new Error('no reply started')), headerTimeoutMs) : null;
    socksConnect(torPort, u.hostname, 443, isolation).then((socket) => {
      raw = socket;
      if (settled) { raw.destroy(); return; }
      raw.on('error', (error) => finish(error));
      agent = new https.Agent({ keepAlive: false });
      agent.createConnection = () => {
        sock = tls.connect({ socket: raw, servername: u.hostname, ...(ca ? { ca } : {}) });
        sock.on('error', (error) => finish(error));
        return sock;
      };
      req = https.request({
        hostname: u.hostname, port: 443, path: u.pathname + u.search, method, agent,
        headers: {
          Host: u.hostname, Accept: media ? 'image/*,audio/*,video/*;q=0.9,*/*;q=0.1' : 'application/json', 'User-Agent': 'CHEESECrypt-Tor-Helper',
          ...(payload ? { 'Content-Type': contentType, 'Content-Length': payload.length } : {}),
        },
      }, (res) => {
        if (headerTimer) clearTimeout(headerTimer);
        const parts = []; let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > (media ? MAX_MEDIA : MAX_BODY)) finish(new Error('response too large')); else parts.push(c);
        });
        res.on('end', () => {
          const responseBody = Buffer.concat(parts);
          if (media) {
            const type = String(res.headers['content-type'] || '').split(';')[0].trim();
            if ((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300 && !MEDIA_TYPE.test(type)) return finish(new Error(`not media (${type || 'no type'})`));
            return finish(null, { status: res.statusCode || 502, type: type || 'application/octet-stream', body: responseBody });
          }
          try { JSON.parse(responseBody.toString('utf8')); } catch { return finish(new Error('server returned invalid JSON')); }
          finish(null, { status: res.statusCode || 502, type: 'application/json', body: responseBody });
        });
        res.on('aborted', () => finish(new Error('incomplete response')));
        res.on('error', (error) => finish(error));
      });
      req.on('error', (error) => finish(error));
      req.end(payload || undefined);
    }).catch((error) => finish(error));
  });
}

/** One HTTPS GET through Tor; resolves only with a complete 2xx JSON body. */
export async function fetchViaTor(torPort, upstream, path, options = {}) {
  const r = await requestViaTor(torPort, upstream, path, { ...options, method: 'GET' });
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
  return r;
}

let upstreamOrder = [...UPSTREAMS];
let chainOrder = [...CHAIN_UPSTREAMS];
/** Health order within a vetted list: healthy first, down hosts dropped, never adds new hosts. */
export function orderByHealth(list, endpoints) {
  if (!Array.isArray(endpoints)) return null;
  const norm = (u) => String(u || '').replace(/\/+$/, '');
  const healthy = endpoints.filter(e => e.status === 'healthy' || e.status === 'degraded').map(e => norm(e.url)).filter(u => list.includes(u));
  const down = new Set(endpoints.filter(e => e.status === 'down').map(e => norm(e.url)));
  const ordered = [...new Set(healthy)];
  const remaining = list.filter(u => !down.has(u) && !ordered.includes(u));
  return ordered.length + remaining.length ? [...ordered, ...remaining] : null;
}
// The standalone download cannot import the app's resolver. Fetch the same
// HerdCheck source through Tor only; an outage leaves the vetted fallback intact.
async function updateHealthOrder(torPort) {
  for (const [feature, list, set] of [
    ['hyperion-v2', UPSTREAMS, (o) => { upstreamOrder = o; }],
    ['chain-api', CHAIN_UPSTREAMS, (o) => { chainOrder = o; }],
  ]) {
    try {
      const r = await fetchViaTor(torPort, 'https://herdcheck.blocdraig.com', `/api/v1/wax/endpoints?feature=${feature}`, { timeoutMs: 6000, isolation: isolationFor('health') });
      const order = orderByHealth(list, JSON.parse(r.body.toString('utf8')).endpoints);
      if (order) set(order);
    } catch { /* health outage never prevents Tor reads; the last order stays */ }
  }
}

function readRequestBody(req, limit = MAX_REQUEST_BODY) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0, settled = false;
    const cleanup = () => {
      req.removeListener('data', onData); req.removeListener('end', onEnd);
      req.removeListener('aborted', onAborted); req.removeListener('error', onError);
    };
    const fail = (message) => {
      if (settled) return;
      settled = true; cleanup(); req.resume(); reject(new Error(message));
    };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > limit) return fail(limit === MAX_REQUEST_BODY ? 'signed transaction is too large' : 'request is too large');
      parts.push(chunk);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true; cleanup(); resolve(Buffer.concat(parts));
    };
    const onAborted = () => fail('incomplete request');
    const onError = () => fail('request failed');
    req.on('data', onData); req.on('end', onEnd);
    req.on('aborted', onAborted); req.on('error', onError);
  });
}

export function createProxyServer({ torPorts = TOR_PORTS, upstreams = UPSTREAMS, chainUpstreams, atomicUpstreams = ATOMIC_UPSTREAMS, ipfsGateways = IPFS_GATEWAYS, alcorUpstreams = ALCOR_UPSTREAMS, ca } = {}) {
  let lastGood = null, turn = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Cache-Control', 'no-store');
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && req.url === '/v2/helper') return send(200, { helper: 'cheesecrypt-tor', version: HELPER_VERSION, features: ['history', 'broadcast', 'atomic', 'ipfs', 'chain', 'respect', 'isolation', 'rotation', 'prep', 'atomic-list', 'resilience'] });

    // Respect lookups (v1.4): read-only, so trying the next server on failure is safe.
    const listMatch = req.method === 'GET' ? ATOMIC_LIST_PATH.exec(req.url || '') : null;
    if (listMatch) {
      const torPort = await findTor(torPorts);
      if (!torPort) return send(503, { error: 'Tor is not running. Open Tor Browser (or start the Tor service) and try again.' });
      const isolation = isolationFor('nftlist');
      const n = turn++;
      for (const upstream of preferReady(rotate(atomicUpstreams, n))) {
        if (res.destroyed) return;
        try {
          const r = await fetchViaTor(torPort, upstream, `/atomicassets/v1/assets?owner=${listMatch[1]}&page=${listMatch[2]}&limit=${listMatch[3]}&order=desc&sort=transferred`, { ca, isolation });
          const j = JSON.parse(r.body.toString('utf8'));
          if (!j?.success || !Array.isArray(j.data)) throw new Error('no NFT list in reply');
          res.writeHead(200, { 'Content-Type': r.type });
          return res.end(r.body);
        } catch (e) { benchFor(upstream, e); console.warn(`  ${new URL(upstream).hostname} NFT list via Tor failed: ${e.message} — trying next`); }
      }
      return send(502, { error: 'Every NFT server failed through Tor. Try again in a minute.' });
    }

    const accountMatch = req.method === 'GET' ? ATOMIC_ACCOUNT_PATH.exec(req.url || '') : null;
    const alcorMatch = req.method === 'GET' ? ALCOR_POSITIONS_PATH.exec(req.url || '') : null;
    const chainRead = req.method === 'POST' && CHAIN_READ_PATH.test(req.url || '');
    if (accountMatch || alcorMatch || chainRead) {
      let body = null;
      if (chainRead) {
        try {
          body = await readRequestBody(req, MAX_READ_BODY);
          if (!body.length) body = Buffer.from('{}'); // get_info and similar may carry no body
          const j = JSON.parse(body.toString('utf8'));
          if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('expected a JSON object');
        } catch (e) { return send(400, { error: `Chain lookup was not forwarded: ${e.message}` }); }
      }
      const torPort = await findTor(torPorts);
      if (!torPort) return send(503, { error: 'Tor is not running. Open Tor Browser (or start the Tor service) and try again.' });
      // Each Respect lookup gets its own new circuit and starts on the next server in turn.
      const isolation = isolationFor('respect');
      const n = turn++;
      if (accountMatch) {
        for (const upstream of preferReady(rotate(atomicUpstreams, n))) {
          if (res.destroyed) return;
          try {
            const r = await fetchViaTor(torPort, upstream, `/atomicassets/v1/accounts/${accountMatch[1]}${accountMatch[2] || ''}`, { ca, isolation });
            const j = JSON.parse(r.body.toString('utf8'));
            if (!j?.success || !j.data) throw new Error('no account in reply');
            res.writeHead(200, { 'Content-Type': r.type });
            return res.end(r.body);
          } catch (e) { benchFor(upstream, e); console.warn(`  ${new URL(upstream).hostname} NFT count via Tor failed: ${e.message} — trying next`); }
        }
        return send(502, { error: 'Every NFT server failed through Tor. Try again in a minute.' });
      }
      if (alcorMatch) {
        for (const upstream of preferReady(alcorUpstreams)) {
          if (res.destroyed) return;
          try {
            const r = await fetchViaTor(torPort, upstream, `/api/v2/account/${alcorMatch[1]}/positions`, { ca, isolation });
            if (!Array.isArray(JSON.parse(r.body.toString('utf8')))) throw new Error('no positions list in reply');
            res.writeHead(200, { 'Content-Type': r.type });
            return res.end(r.body);
          } catch (e) { benchFor(upstream, e); console.warn(`  ${new URL(upstream).hostname} Alcor lookup via Tor failed: ${e.message} — trying next`); }
        }
        return send(502, { error: 'Alcor failed through Tor. Try again in a minute.' });
      }
      // Complete nodeos replies (including 4xx errors) are returned; 5xx and network failures try the next server.
      let lastReply = null;
      for (const upstream of preferReady(rotate(chainUpstreams || (upstreams === UPSTREAMS ? chainOrder : upstreams), n))) {
        if (res.destroyed) return;
        try {
          const r = await requestViaTor(torPort, upstream, req.url, { method: 'POST', body, contentType: 'application/json', ca, isolation });
          if (r.status >= 500) { lastReply = r; throw new Error(`HTTP ${r.status}`); }
          res.writeHead(r.status, { 'Content-Type': r.type });
          return res.end(r.body);
        } catch (e) { benchFor(upstream, e); console.warn(`  ${new URL(upstream).hostname} chain lookup via Tor failed: ${e.message} — trying next`); }
      }
      if (lastReply) { res.writeHead(lastReply.status, { 'Content-Type': lastReply.type }); return res.end(lastReply.body); }
      return send(502, { error: 'Every WAX server failed through Tor. Try again in a minute.' });
    }

    const atomicMatch = req.method === 'GET' ? ATOMIC_PATH.exec(req.url || '') : null;
    const ipfsRequest = req.method === 'GET' && mediaPathAllowed(req.url);
    if (atomicMatch || ipfsRequest) {
      const torPort = await findTor(torPorts);
      if (!torPort) return send(503, { error: 'Tor is not running. Open Tor Browser (or start the Tor service) and try again.' });
      const isolation = isolationFor('media');
      const n = turn++;
      if (atomicMatch) {
        for (const upstream of preferReady(rotate(atomicUpstreams, n))) {
          if (res.destroyed) return;
          try {
            const r = await fetchViaTor(torPort, upstream, `/atomicassets/v1/assets/${atomicMatch[1]}`, { ca, isolation });
            const j = JSON.parse(r.body.toString('utf8'));
            if (!j?.success || !j.data) throw new Error('no asset in reply');
            res.writeHead(200, { 'Content-Type': r.type });
            return res.end(r.body);
          } catch (e) { benchFor(upstream, e); console.warn(`  ${new URL(upstream).hostname} NFT lookup via Tor failed: ${e.message} — trying next`); }
        }
        return send(502, { error: 'Every NFT server failed through Tor. Try again in a minute.' });
      }
      for (const gateway of preferReady(rotate(ipfsGateways, n))) {
        if (res.destroyed) return;
        try {
          const r = await requestViaTor(torPort, gateway, req.url, { ca, media: true, timeoutMs: MEDIA_TIMEOUT_MS, headerTimeoutMs: MEDIA_HEADER_TIMEOUT_MS, isolation });
          if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
          // Served to <img>/<audio>/<video> only: no sniffing, no scripts, no framing.
          res.writeHead(200, { 'Content-Type': r.type, 'Content-Length': r.body.length, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'cross-origin' });
          return res.end(r.body);
        } catch (e) { benchFor(gateway, e); console.warn(`  ${new URL(gateway).hostname} media via Tor failed: ${e.message} — trying next`); }
      }
      return send(502, { error: 'Every IPFS gateway failed through Tor. Try again in a minute.' });
    }
    const historyRequest = req.method === 'GET' && ALLOWED_PATH.test(req.url || '');
    const broadcastRequest = req.method === 'POST' && BROADCAST_PATH.test(req.url || '');
    if (!historyRequest && !broadcastRequest) return send(403, { error: 'Only WAX history reads, Respect lookups, signed transaction broadcasts, NFT lookups and IPFS media are forwarded.' });

    const torPort = await findTor(torPorts);
    if (!torPort) return send(503, { error: 'Tor is not running. Open Tor Browser (or start the Tor service) and try again.' });

    const available = upstreams === UPSTREAMS ? upstreamOrder : upstreams;
    const order = preferReady(lastGood ? [lastGood, ...available.filter(u => u !== lastGood)] : available);

    if (broadcastRequest) {
      let body;
      try {
        body = await readRequestBody(req);
        JSON.parse(body.toString('utf8'));
      } catch (e) {
        return send(400, { error: `Signed transaction was not forwarded: ${e.message}` });
      }

      // Never rotate or retry a signed transaction. Even a timeout or HTTP failure
      // can follow acceptance by nodeos, so a second attempt could duplicate it.
      const upstream = order[0];
      try {
        const r = await requestViaTor(torPort, upstream, req.url, {
          method: 'POST', body, timeoutMs: BROADCAST_TIMEOUT_MS,
          contentType: req.headers['content-type'] || 'text/plain;charset=UTF-8', ca,
          isolation: isolationFor('broadcast'),
        });
        lastGood = upstream;
        res.writeHead(r.status, { 'Content-Type': r.type });
        return res.end(r.body);
      } catch (e) {
        console.warn(`  ${new URL(upstream).hostname} broadcast via Tor failed: ${e.message} — not retried`);
        return send(502, { error: 'No valid reply arrived for the signed transaction. It may already be on-chain; check the account before retrying. No other server was tried.' });
      }
    }

    for (const upstream of order) {
      if (res.destroyed) return;
      try {
        const r = await fetchViaTor(torPort, upstream, req.url, { ca, isolation: isolationFor('history') });
        const j = JSON.parse(r.body.toString('utf8'));
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if ((pathname.endsWith('/get_actions') || pathname.endsWith('/get_transaction')) && !Array.isArray(j.actions)) throw new Error('server returned no actions array');
        lastGood = upstream;
        res.writeHead(200, { 'Content-Type': r.type });
        return res.end(r.body);
      } catch (e) {
        benchFor(upstream, e);
        console.warn(`  ${new URL(upstream).hostname} via Tor failed: ${e.message} — trying next`);
      }
    }
    send(502, { error: 'Every public history server failed through Tor. Try again in a minute (Tor may pick a new route).' });
  });
}

export const server = createProxyServer();

// 127.0.0.1 only: nobody else on your network or the internet can use this helper.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) server.listen(LISTEN_PORT, '127.0.0.1', async () => {
  const tor = await findTor();
  console.log(`\n🧅 CHEESECrypt Tor helper v${HELPER_VERSION} is running`);
  console.log(`   Address for CHEESECrypt: http://localhost:${LISTEN_PORT}`);
  console.log('   History reads, Respect lookups, single-attempt signed broadcasts and chat NFT media use Tor');
  console.log('   Each kind of traffic uses its own Tor circuit; Respect and NFT lookups rotate servers');
  console.log('   Busy or slow servers sit out briefly; server health refreshes every 10 minutes');
  console.log(tor ? `   Tor port ${tor} is open (connection verified on first request)` : '   ⚠️  Tor not found yet — open Tor Browser or start the Tor service');
  console.log('   Leave this window open. Press Ctrl+C to stop.\n');
  if (tor) void updateHealthOrder(tor);
  // Refresh health through Tor every 10 minutes; never keeps the process alive on its own.
  setInterval(async () => { const t = await findTor(); if (t) void updateHealthOrder(t); }, HEALTH_REFRESH_MS).unref();
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${LISTEN_PORT} is already in use. Is the helper already running?` : e.message);
  process.exit(1);
});
