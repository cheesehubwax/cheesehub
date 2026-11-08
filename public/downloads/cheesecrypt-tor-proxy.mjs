#!/usr/bin/env node
// CHEESECrypt Tor helper — open source, no dependencies, runs only on your own computer.
//
// What it does: listens on http://127.0.0.1:8088 and forwards READ-ONLY WAX history
// requests (GET /v2/history/... and /v2/health) through your local Tor client to public
// Hyperion servers, so those servers see a Tor exit address instead of your home IP.
//
// What it does NOT do: it is not a Tor relay or exit node, it never accepts connections
// from other computers, it never sends transactions, and it keeps no logs or files.
//
// Run:  node cheesecrypt-tor-proxy.mjs
// Then in CHEESECrypt → Menu → Privacy → "Your own history server" enter http://localhost:8088
//
// Needs Node.js 18+ and Tor running (Tor Browser open = port 9150, Tor service = port 9050).

import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';

const LISTEN_PORT = Number(process.env.PORT || 8088);
const TOR_PORTS = [9150, 9050];
const UPSTREAMS = [
  'https://api.waxsweden.org',
  'https://wax.eosphere.io',
  'https://wax.eosdac.io',
  'https://wax.eosusa.io',
];
const TIMEOUT_MS = 30000;
const MAX_BODY = 20 * 1024 * 1024;
const ALLOWED_PATH = /^\/v2\/(history\/[a-z_]+|health)(\?|$)/;

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
        s.removeAllListeners('data'); s.setTimeout(0);
        stage = 2; resolve(s);
      }
    });
  });
}

let torPortInUse = null;
async function findTor() {
  for (const p of torPortInUse ? [torPortInUse, ...TOR_PORTS] : TOR_PORTS) {
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

/** One HTTPS GET through Tor; resolves only with a complete 2xx body. */
async function fetchViaTor(torPort, upstream, path) {
  const u = new URL(path, upstream);
  const raw = await socksConnect(torPort, u.hostname, 443);
  const sock = tls.connect({ socket: raw, servername: u.hostname });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { Host: u.hostname, Accept: 'application/json', 'User-Agent': 'CHEESECrypt-Tor-Helper/1.0' },
      createConnection: () => sock, agent: false, timeout: TIMEOUT_MS,
    }, (res) => {
      const parts = []; let size = 0;
      res.on('data', (c) => { size += c.length; if (size > MAX_BODY) { req.destroy(new Error('response too large')); } else parts.push(c); });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve({ type: res.headers['content-type'] || 'application/json', body: Buffer.concat(parts) });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET' || !ALLOWED_PATH.test(req.url || '')) return send(403, { error: 'Only read-only WAX history requests are forwarded.' });

  const torPort = await findTor();
  if (!torPort) return send(503, { error: 'Tor is not running. Open Tor Browser (or start the Tor service) and try again.' });

  for (const upstream of UPSTREAMS) {
    try {
      const r = await fetchViaTor(torPort, upstream, req.url);
      res.writeHead(200, { 'Content-Type': r.type });
      return res.end(r.body);
    } catch (e) {
      console.warn(`  ${new URL(upstream).hostname} via Tor failed: ${e.message} — trying next`);
    }
  }
  send(502, { error: 'Every public history server failed through Tor. Try again in a minute (Tor may pick a new route).' });
});

// 127.0.0.1 only: nobody else on your network or the internet can use this helper.
server.listen(LISTEN_PORT, '127.0.0.1', async () => {
  const tor = await findTor();
  console.log('\n🧅 CHEESECrypt Tor helper is running');
  console.log(`   Address for CHEESECrypt: http://localhost:${LISTEN_PORT}`);
  console.log(tor ? `   Tor found on port ${tor} ✅` : '   ⚠️  Tor not found yet — open Tor Browser or start the Tor service');
  console.log('   Leave this window open. Press Ctrl+C to stop.\n');
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${LISTEN_PORT} is already in use. Is the helper already running?` : e.message);
  process.exit(1);
});
