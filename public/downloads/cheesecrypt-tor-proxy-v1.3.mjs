#!/usr/bin/env node
// CHEESECrypt Tor helper — open source, no dependencies, runs only on your own computer.
//
// What it does: listens on http://127.0.0.1:8088 and forwards WAX history reads
// (GET /v2/history/... and /v2/health) plus already-signed transaction broadcasts
// (POST /v1/chain/send_transaction or push_transaction) through your local Tor client.
// v1.3 also forwards chat NFT lookups (GET /atomic/v1/assets/<id>) and NFT pictures,
// sounds and videos (GET /ipfs/<cid>) so AtomicAssets and IPFS gateways never see you.
// Those public servers see a Tor exit address instead of your home IP.
//
// What it does NOT do: it is not a Tor relay or exit node, it never accepts connections
// from other computers, it never signs or changes transactions, and it writes no traffic
// logs or files. Media is passed through in memory only (never saved to disk). A broadcast is attempted on ONE upstream only, never retried: a lost
// reply does not prove the chain rejected it. Check the account before manually retrying.
//
// Run:  node cheesecrypt-tor-proxy-v1.3.mjs
// Then in CHEESECrypt → Menu → Privacy → "Your own history server" enter http://localhost:8088
// Tick "Use only this server" to route CHEESECrypt's signed broadcasts here too.
//
// Needs Node.js 18+ and Tor running (Tor Browser open = port 9150, Tor service = port 9050).

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { pathToFileURL } from 'node:url';

const LISTEN_PORT = Number(process.env.PORT || 8088);
const TOR_PORTS = [9150, 9050];
const UPSTREAMS = [
  'https://api.waxsweden.org',
  'https://wax.eosphere.io',
  'https://wax.eosdac.io',
  'https://wax.eosusa.io',
];
const ATOMIC_UPSTREAMS = [
  'https://wax.api.atomicassets.io',
  'https://aa.wax.blacklusion.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://atomic.wax.eosrio.io',
];
const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io',
  'https://dweb.link',
  'https://nftstorage.link',
  'https://ipfs.io',
];
export const HELPER_VERSION = '1.3';
export const TIMEOUT_MS = 8000;
export const MEDIA_TIMEOUT_MS = 45000;
export const MAX_MEDIA = 50 * 1024 * 1024;
const ATOMIC_PATH = /^\/atomic\/v1\/assets\/(\d{1,20})$/;
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
function socksConnect(torPort, host, port) {
  return new Promise((resolve, reject) => {
    const s = net.connect(torPort, '127.0.0.1');
    let stage = 0, buf = Buffer.alloc(0);
    const fail = (e) => { s.destroy(); reject(e instanceof Error ? e : new Error(String(e))); };
    s.setTimeout(TIMEOUT_MS, () => fail('Tor connection timed out'));
    s.on('error', fail);
    s.on('connect', () => s.write(Buffer.from([5, 1, 0])));
    s.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (stage === 0) {
        if (buf.length < 2) return;
        if (buf[0] !== 5 || buf[1] !== 0) return fail('Tor refused the handshake');
        buf = buf.subarray(2); stage = 1;
        const h = Buffer.from(host);
        s.write(Buffer.concat([Buffer.from([5, 1, 0, 3, h.length]), h, Buffer.from([port >> 8, port & 255])]));
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
export function requestViaTor(torPort, upstream, path, { method = 'GET', body, contentType = 'text/plain;charset=UTF-8', timeoutMs = TIMEOUT_MS, ca, media = false } = {}) {
  const base = new URL(upstream);
  const u = new URL(path, base);
  if (u.protocol !== 'https:' || u.origin !== base.origin) return Promise.reject(new Error('upstream must stay on the original HTTPS server'));
  const payload = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return new Promise((resolve, reject) => {
    let raw, sock, req, agent, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      req?.destroy(); sock?.destroy(); raw?.destroy(); agent?.destroy();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('timed out')), timeoutMs);
    socksConnect(torPort, u.hostname, 443).then((socket) => {
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
// The standalone download cannot import the app's resolver. Fetch the same
// HerdCheck source through Tor only; an outage leaves the vetted fallback intact.
async function updateHealthOrder(torPort) {
  try {
    const r = await fetchViaTor(torPort, 'https://herdcheck.blocdraig.com', '/api/v1/wax/endpoints?feature=hyperion-v2', { timeoutMs: 4000 });
    const j = JSON.parse(r.body.toString('utf8'));
    if (!Array.isArray(j.endpoints)) return;
    const healthy = j.endpoints.filter(e => e.status === 'healthy' || e.status === 'degraded');
    const down = new Set(j.endpoints.filter(e => e.status === 'down').map(e => e.url?.replace(/\/+$/, '')));
    const ordered = healthy.map(e => e.url?.replace(/\/+$/, '')).filter(u => UPSTREAMS.includes(u));
    const remaining = UPSTREAMS.filter(u => !down.has(u) && !ordered.includes(u));
    if (ordered.length + remaining.length) upstreamOrder = [...ordered, ...remaining];
  } catch { /* health outage never prevents Tor reads */ }
}

function readRequestBody(req) {
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
      if (size > MAX_REQUEST_BODY) return fail('signed transaction is too large');
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

export function createProxyServer({ torPorts = TOR_PORTS, upstreams = UPSTREAMS, atomicUpstreams = ATOMIC_UPSTREAMS, ipfsGateways = IPFS_GATEWAYS, ca } = {}) {
  let lastGood = null;
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Cache-Control', 'no-store');
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && req.url === '/v2/helper') return send(200, { helper: 'cheesecrypt-tor', version: HELPER_VERSION, features: ['history', 'broadcast', 'atomic', 'ipfs'] });

    const atomicMatch = req.method === 'GET' ? ATOMIC_PATH.exec(req.url || '') : null;
    const ipfsRequest = req.method === 'GET' && mediaPathAllowed(req.url);
    if (atomicMatch || ipfsRequest) {
      const torPort = await findTor(torPorts);
      if (!torPort) return send(503, { error: 'Tor is not running. Open Tor Browser (or start the Tor service) and try again.' });
      if (atomicMatch) {
        for (const upstream of atomicUpstreams) {
          if (res.destroyed) return;
          try {
            const r = await fetchViaTor(torPort, upstream, `/atomicassets/v1/assets/${atomicMatch[1]}`, { ca });
            const j = JSON.parse(r.body.toString('utf8'));
            if (!j?.success || !j.data) throw new Error('no asset in reply');
            res.writeHead(200, { 'Content-Type': r.type });
            return res.end(r.body);
          } catch (e) { console.warn(`  ${new URL(upstream).hostname} NFT lookup via Tor failed: ${e.message} — trying next`); }
        }
        return send(502, { error: 'Every NFT server failed through Tor. Try again in a minute.' });
      }
      for (const gateway of ipfsGateways) {
        if (res.destroyed) return;
        try {
          const r = await requestViaTor(torPort, gateway, req.url, { ca, media: true, timeoutMs: MEDIA_TIMEOUT_MS });
          if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
          // Served to <img>/<audio>/<video> only: no sniffing, no scripts, no framing.
          res.writeHead(200, { 'Content-Type': r.type, 'Content-Length': r.body.length, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'cross-origin' });
          return res.end(r.body);
        } catch (e) { console.warn(`  ${new URL(gateway).hostname} media via Tor failed: ${e.message} — trying next`); }
      }
      return send(502, { error: 'Every IPFS gateway failed through Tor. Try again in a minute.' });
    }
    const historyRequest = req.method === 'GET' && ALLOWED_PATH.test(req.url || '');
    const broadcastRequest = req.method === 'POST' && BROADCAST_PATH.test(req.url || '');
    if (!historyRequest && !broadcastRequest) return send(403, { error: 'Only WAX history reads, signed transaction broadcasts, NFT lookups and IPFS media are forwarded.' });

    const torPort = await findTor(torPorts);
    if (!torPort) return send(503, { error: 'Tor is not running. Open Tor Browser (or start the Tor service) and try again.' });

    const available = upstreams === UPSTREAMS ? upstreamOrder : upstreams;
    const order = lastGood ? [lastGood, ...available.filter(u => u !== lastGood)] : available;

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
        const r = await fetchViaTor(torPort, upstream, req.url, { ca });
        const j = JSON.parse(r.body.toString('utf8'));
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if ((pathname.endsWith('/get_actions') || pathname.endsWith('/get_transaction')) && !Array.isArray(j.actions)) throw new Error('server returned no actions array');
        lastGood = upstream;
        res.writeHead(200, { 'Content-Type': r.type });
        return res.end(r.body);
      } catch (e) {
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
  console.log('\n🧅 CHEESECrypt Tor helper v${HELPER_VERSION} is running');
  console.log(`   Address for CHEESECrypt: http://localhost:${LISTEN_PORT}`);
  console.log('   History reads, single-attempt signed broadcasts and chat NFT media use Tor');
  console.log(tor ? `   Tor port ${tor} is open (connection verified on first request)` : '   ⚠️  Tor not found yet — open Tor Browser or start the Tor service');
  console.log('   Leave this window open. Press Ctrl+C to stop.\n');
  if (tor) void updateHealthOrder(tor);
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${LISTEN_PORT} is already in use. Is the helper already running?` : e.message);
  process.exit(1);
});
