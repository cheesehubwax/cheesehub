import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import net from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetchViaTor, server, TIMEOUT_MS } from '../../public/downloads/cheesecrypt-tor-proxy.mjs';

const folder = mkdtempSync(join(tmpdir(), 'crypt-tor-test-'));
const sockets = new Set();
let ca, upstream, socks, socksPort, proxyPort;
const destinations = [];
const track = s => { sockets.add(s); s.on('close', () => sockets.delete(s)); return s; };
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));

before(async () => {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(folder, 'key.pem'), '-out', join(folder, 'cert.pem'), '-days', '1', '-subj', '/CN=history.invalid', '-addext', 'subjectAltName=DNS:history.invalid'], { stdio: 'ignore' });
  ca = readFileSync(join(folder, 'cert.pem'));
  upstream = https.createServer({ key: readFileSync(join(folder, 'key.pem')), cert: ca }, (req, res) => {
    if (req.url === '/stall') { res.writeHead(200); res.write('{'); return; }
    if (req.url === '/bad-json') { res.end('<html>not history</html>'); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ actions: [{ trx_id: 'verified-through-socks' }] }));
  });
  upstream.on('connection', track);
  const upstreamPort = await listen(upstream);
  socks = net.createServer(socket => {
    track(socket);
    let stage = 0, buffer = Buffer.alloc(0);
    const handshake = chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (stage === 0 && buffer.length >= 3) {
        assert.deepEqual([...buffer.subarray(0, 3)], [5, 1, 0]);
        buffer = buffer.subarray(3); stage = 1;
        socket.write(Buffer.from([5]));
        setImmediate(() => socket.write(Buffer.from([0])));
      }
      if (stage === 1 && buffer.length >= 5 && buffer.length >= 7 + buffer[4]) {
        assert.equal(buffer[3], 3, 'domain is sent to SOCKS, not resolved locally');
        const length = buffer[4];
        destinations.push({ host: buffer.subarray(5, 5 + length).toString(), port: buffer.readUInt16BE(5 + length) });
        socket.removeListener('data', handshake);
        const remote = track(net.connect(upstreamPort, '127.0.0.1', () => {
          socket.write(Buffer.from([5, 0, 0, 1, 127]));
          setImmediate(() => {
            socket.write(Buffer.from([0, 0, 1, 0, 0]));
            socket.pipe(remote); remote.pipe(socket);
          });
        }));
        remote.on('error', () => socket.destroy());
        socket.on('close', () => remote.destroy());
      }
    };
    socket.on('data', handshake);
  });
  socksPort = await listen(socks);
  proxyPort = await listen(server);
});

after(async () => {
  for (const s of sockets) s.destroy();
  await Promise.all([upstream, socks, server].map(s => new Promise(r => s.close(r))));
  rmSync(folder, { recursive: true, force: true });
});

test('HTTPS reaches an otherwise unresolvable hostname exclusively through SOCKS', async () => {
  const r = await fetchViaTor(socksPort, 'https://history.invalid', '/v2/history/get_actions', { ca });
  assert.equal(JSON.parse(r.body).actions[0].trx_id, 'verified-through-socks');
  assert.deepEqual(destinations.at(-1), { host: 'history.invalid', port: 443 });
  assert.equal(TIMEOUT_MS, 8000);
});

test('TLS certificate verification remains enabled', async () => {
  await assert.rejects(fetchViaTor(socksPort, 'https://history.invalid', '/v2/history/get_actions'), /self-signed certificate/);
});

test('a stalled response body is bounded by the whole request timeout', async () => {
  const start = Date.now();
  await assert.rejects(fetchViaTor(socksPort, 'https://history.invalid', '/stall', { ca, timeoutMs: 150 }), /timed out/);
  assert.ok(Date.now() - start < 1500);
});

test('HTML cannot be accepted as a successful history response', async () => {
  await assert.rejects(fetchViaTor(socksPort, 'https://history.invalid', '/bad-json', { ca }), /invalid JSON/);
});

test('loopback helper blocks writes and non-history paths, and supports browser preflight', async () => {
  const base = `http://127.0.0.1:${proxyPort}`;
  for (const [path, method] of [['/v1/chain/push_transaction', 'POST'], ['/v1/chain/get_info', 'GET'], ['//other.example/v2/history/get_actions', 'GET']]) {
    assert.equal((await fetch(base + path, { method })).status, 403);
  }
  const preflight = await fetch(base + '/v2/history/get_actions', { method: 'OPTIONS', headers: { Origin: 'https://pristine-space-play.lovable.app', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
});