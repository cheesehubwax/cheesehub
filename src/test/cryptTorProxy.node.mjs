import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import net from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { benchFor, clearBench, createProxyServer, requestViaTor, fetchViaTor, isolationFor, orderByHealth, preferReady, rotate, youtubeRequest, TIMEOUT_MS } from '../../public/downloads/cheesecrypt-tor-proxy-v1.8.mjs';

const CID = 'QmYTvGVY8eVxrzYf7VTgqJJqZiNJF7gAfji6ewxo4qUyeM';
const folder = mkdtempSync(join(tmpdir(), 'crypt-tor-test-'));
const sockets = new Set();
const destinations = [];
const upstreamRequests = [];
const labels = [];
let ca, upstream, socks, proxy, socksPort, proxyPort;
const track = s => { sockets.add(s); s.on('close', () => sockets.delete(s)); return s; };
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));

before(async () => {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(folder, 'key.pem'), '-out', join(folder, 'cert.pem'), '-days', '1', '-subj', '/CN=history.invalid', '-addext', 'subjectAltName=DNS:history.invalid'], { stdio: 'ignore' });
  ca = readFileSync(join(folder, 'cert.pem'));
  upstream = https.createServer({ key: readFileSync(join(folder, 'key.pem')), cert: ca }, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    upstreamRequests.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8') });
    if (req.url === '/stall') { res.writeHead(200); res.write('{'); return; }
    if (req.url === `/ipfs/${CID}/art.png`) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(Buffer.from([137, 80, 78, 71])); return; }
    if (req.url === `/ipfs/${CID}/page.html`) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<script>alert(1)</script>'); return; }
    if (req.url === '/vi/dQw4w9WgXcQ/mqdefault.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(Buffer.from([255, 216, 255])); return; }
    if (req.url === '/api/v1/videos/dQw4w9WgXcQ?fields=title') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ title: 'Song', ignored: 'not forwarded' })); return; }
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/atomicassets/v1/assets/42') { res.end(JSON.stringify({ success: true, data: { asset_id: '42' } })); return; }
    if (req.url === '/v1/chain/get_account') { res.end(JSON.stringify({ account_name: JSON.parse(upstreamRequests.at(-1).body).account_name, created: '2020-01-01T00:00:00.000' })); return; }
    if (req.url === '/v1/chain/get_currency_balance') { res.writeHead(500); res.end(JSON.stringify({ error: { what: 'no contract' } })); return; }
    if (req.url === '/atomicassets/v1/accounts/bob?collection_whitelist=cheesenftwax') { res.end(JSON.stringify({ success: true, data: { collections: [] } })); return; }
    if (req.url === '/api/v2/account/bob/positions') { res.end(JSON.stringify([{ pool: 7 }])); return; }
    if (req.url === '/bad-json') { res.end('<html>not history</html>'); return; }
    if (req.url === '/v1/chain/send_transaction') {
      res.writeHead(202);
      res.end(JSON.stringify({ transaction_id: 'verified-signed-broadcast' }));
      return;
    }
    if (req.url === '/v1/chain/push_transaction') {
      res.writeHead(500);
      res.end(JSON.stringify({ error: { details: [{ message: 'deliberate chain rejection' }] } }));
      return;
    }
    res.end(JSON.stringify({ actions: [{ trx_id: 'verified-through-socks' }] }));
  });
  upstream.on('connection', track);
  const upstreamPort = await listen(upstream);
  socks = net.createServer(socket => {
    track(socket);
    let stage = 0, buffer = Buffer.alloc(0);
    const handshake = chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (stage === 0 && buffer.length >= 2 && buffer.length >= 2 + buffer[1]) {
        assert.equal(buffer[0], 5);
        const methods = [...buffer.subarray(2, 2 + buffer[1])];
        buffer = buffer.subarray(2 + buffer[1]);
        // Like Tor: prefer username/password when offered, so the label picks the circuit.
        stage = methods.includes(2) ? 2 : 1;
        if (stage === 1) labels.push(null);
        socket.write(Buffer.from([5]));
        setImmediate(() => socket.write(Buffer.from([stage === 2 ? 2 : 0])));
      }
      if (stage === 2 && buffer.length >= 2 && buffer.length >= 3 + buffer[1] && buffer.length >= 3 + buffer[1] + buffer[2 + buffer[1]]) {
        assert.equal(buffer[0], 1);
        const ulen = buffer[1], plen = buffer[2 + ulen];
        labels.push(buffer.subarray(2, 2 + ulen).toString());
        buffer = buffer.subarray(3 + ulen + plen); stage = 1;
        socket.write(Buffer.from([1, 0]));
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
  proxy = createProxyServer({ torPorts: [socksPort], upstreams: ['https://history.invalid'], atomicUpstreams: ['https://history.invalid'], ipfsGateways: ['https://history.invalid'], alcorUpstreams: ['https://history.invalid'], youtubeUpstreams: ['https://history.invalid'], ca });
  proxyPort = await listen(proxy);
});

after(async () => {
  for (const s of sockets) s.destroy();
  await Promise.all([upstream, socks, proxy].map(s => new Promise(r => s.close(r))));
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

test('the loopback helper forwards exact signed broadcast bytes through Tor', async () => {
  const body = '{"signatures":["SIG_K1_signed"],"packed_trx":"deadbeef"}';
  const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/chain/send_transaction`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body,
  });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).transaction_id, 'verified-signed-broadcast');
  const sent = upstreamRequests.at(-1);
  assert.equal(sent.method, 'POST');
  assert.equal(sent.url, '/v1/chain/send_transaction');
  assert.equal(sent.body, body, 'signed bytes are not reserialized or modified');
});

test('a nodeos broadcast rejection is returned once without an upstream retry', async () => {
  const before = upstreamRequests.length;
  const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/chain/push_transaction`, {
    method: 'POST', body: '{"signatures":[],"packed_trx":"00"}',
  });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.details[0].message, 'deliberate chain rejection');
  assert.equal(upstreamRequests.length - before, 1);
});

test('malformed broadcast JSON is rejected before using Tor', async () => {
  const before = upstreamRequests.length;
  const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/chain/send_transaction`, { method: 'POST', body: 'not-json' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /not forwarded/);
  assert.equal(upstreamRequests.length, before);
});

test('loopback helper blocks other writes and non-history paths, and supports browser preflight', async () => {
  const base = `http://127.0.0.1:${proxyPort}`;
  for (const [path, method] of [
    ['/v1/chain/push_transaction', 'GET'],
    ['/v1/chain/get_info', 'GET'],
    ['/v1/chain/get_table_rows', 'GET'],
    ['/v1/chain/get_producer_schedule', 'POST'],
    ['/atomic/v1/assets?owner=bob&page=1&limit=100', 'GET'],
    ['/v1/chain/push_action', 'POST'],
    ['//other.example/v2/history/get_actions', 'GET'],
  ]) {
    assert.equal((await fetch(base + path, { method })).status, 403);
  }
  const preflight = await fetch(base + '/v1/chain/send_transaction', { method: 'OPTIONS', headers: { Origin: 'https://pristine-space-play.lovable.app', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
});

test('v1.8 reports its media, Respect, isolation, rotation, prep and NFT list capabilities', async () => {
  const j = await (await fetch(`http://127.0.0.1:${proxyPort}/v2/helper`)).json();
  assert.equal(j.version, '1.8');
  for (const f of ['atomic', 'ipfs', 'chain', 'respect', 'isolation', 'rotation', 'prep', 'atomic-list', 'resilience', 'youtube']) assert.ok(j.features.includes(f), f);
});

test('circuit labels: steady history, four media lanes, fresh Respect and broadcast circuits', () => {
  assert.equal(isolationFor('history'), isolationFor('history'));
  assert.notEqual(isolationFor('respect'), isolationFor('respect'));
  assert.notEqual(isolationFor('broadcast'), isolationFor('broadcast'));
  const lanes = new Set(Array.from({ length: 12 }, () => isolationFor('media')));
  assert.equal(lanes.size, 4);
});

test('rotation starts on the next server each time and keeps every server as a fallback', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(rotate(list, 0), ['a', 'b', 'c']);
  assert.deepEqual(rotate(list, 1), ['b', 'c', 'a']);
  assert.deepEqual(rotate(list, 5), ['c', 'a', 'b']);
  assert.deepEqual(rotate(['x'], 3), ['x']);
});

test('each Respect lookup and each broadcast reaches Tor on its own circuit label', async () => {
  const base = `http://127.0.0.1:${proxyPort}`;
  const before = labels.length;
  await fetch(`${base}/v1/chain/get_account`, { method: 'POST', body: '{"account_name":"bob"}' });
  await fetch(`${base}/v1/chain/get_account`, { method: 'POST', body: '{"account_name":"bob"}' });
  await fetch(`${base}/v1/chain/send_transaction`, { method: 'POST', body: '{"signatures":[],"packed_trx":"00"}' });
  await fetch(`${base}/v2/history/get_actions`);
  await fetch(`${base}/v2/history/get_actions`);
  const got = labels.slice(before);
  assert.equal(got.length, 5);
  assert.ok(got.every(l => typeof l === 'string' && l.length > 0), 'every helper stream carries a label');
  assert.equal(new Set(got.slice(0, 3)).size, 3, 'two Respect lookups and a broadcast never share a circuit');
  assert.equal(got[3], got[4], 'history keeps one steady circuit');
  assert.ok(!got.slice(0, 3).includes(got[3]));
});

test('Respect lookups travel through SOCKS with their exact bodies', async () => {
  const base = `http://127.0.0.1:${proxyPort}`;
  const before = destinations.length;
  const body = JSON.stringify({ account_name: 'bob' });
  const acct = await fetch(`${base}/v1/chain/get_account`, { method: 'POST', body });
  assert.equal(acct.status, 200);
  assert.equal((await acct.json()).account_name, 'bob');
  assert.equal(upstreamRequests.at(-1).body, body);
  const bal = await fetch(`${base}/v1/chain/get_currency_balance`, { method: 'POST', body: '{"code":"x","account":"bob","symbol":"CHEESE"}' });
  assert.equal(bal.status, 500, 'a complete nodeos error is passed back for the app to interpret');
  const nft = await fetch(`${base}/atomic/v1/accounts/bob?collection_whitelist=cheesenftwax`);
  assert.deepEqual((await nft.json()).data.collections, []);
  const pos = await fetch(`${base}/alcor/v2/account/bob/positions`);
  assert.deepEqual(await pos.json(), [{ pool: 7 }]);
  assert.ok(destinations.slice(before).every(d => d.host === 'history.invalid'));
  assert.equal(destinations.length - before, 4);
});

test('malformed or unsafe Respect lookups are refused before using Tor', async () => {
  const base = `http://127.0.0.1:${proxyPort}`;
  const before = upstreamRequests.length;
  assert.equal((await fetch(`${base}/v1/chain/get_account`, { method: 'POST', body: 'nope' })).status, 400);
  assert.equal((await fetch(`${base}/v1/chain/get_account`, { method: 'POST', body: '[1]' })).status, 400);
  assert.equal((await fetch(`${base}/v1/chain/get_table_rows`, { method: 'POST', body: JSON.stringify({ pad: 'x'.repeat(20000) }) })).status, 400);
  for (const path of ['/atomic/v1/accounts/BOB', '/atomic/v1/accounts/bob?limit=5', '/alcor/v2/account/bob/orders', '/alcor/v2/account/../positions']) {
    assert.equal((await fetch(base + path)).status, 403, path);
  }
  assert.equal(upstreamRequests.length, before);
});

test('chat NFT lookups and IPFS pictures travel through SOCKS', async () => {
  const before = destinations.length;
  const a = await fetch(`http://127.0.0.1:${proxyPort}/atomic/v1/assets/42`);
  assert.equal((await a.json()).data.asset_id, '42');
  const img = await fetch(`http://127.0.0.1:${proxyPort}/ipfs/${CID}/art.png`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual([...new Uint8Array(await img.arrayBuffer())], [137, 80, 78, 71]);
  assert.ok(destinations.slice(before).every(d => d.host === 'history.invalid'));
  assert.equal(destinations.length - before, 2);
});

test('non-media gateway replies and unsafe media paths are refused', async () => {
  const base = `http://127.0.0.1:${proxyPort}`;
  assert.equal((await fetch(`${base}/ipfs/${CID}/page.html`)).status, 502);
  for (const path of [`/ipfs/${CID}/..`, `/ipfs/${CID}/%2e%2e`, '/ipfs/notacid', `/ipfs/${CID}?x=1`, '/atomic/v1/assets/abc', '/atomic/v1/collections/x']) {
    assert.equal((await fetch(base + path)).status, 403, path);
  }
});

test('rate-limited, overloaded and unreachable servers sit out but stay as a last resort', () => {
  clearBench();
  const list = ['https://a', 'https://b', 'https://c', 'https://d'];
  benchFor('https://a', new Error('HTTP 429'));
  benchFor('https://b', new Error('HTTP 503'));
  benchFor('https://c', new Error('timed out'));
  benchFor('https://d', new Error('HTTP 404'));
  assert.deepEqual(preferReady(list), ['https://d', 'https://a', 'https://b', 'https://c']);
  assert.deepEqual(preferReady(list, Date.now() + 31000), ['https://b', 'https://c', 'https://d', 'https://a']);
  assert.deepEqual(preferReady(list, Date.now() + 61000), list);
  clearBench();
});

test('health ordering never adds unvetted hosts and drops only reported-down ones', () => {
  const list = ['https://a', 'https://b', 'https://c'];
  assert.deepEqual(orderByHealth(list, [{ url: 'https://c/', status: 'healthy' }, { url: 'https://evil', status: 'healthy' }, { url: 'https://a', status: 'down' }]), ['https://c', 'https://b']);
  assert.equal(orderByHealth(list, undefined), null);
  assert.equal(orderByHealth(list, list.map(url => ({ url, status: 'down' }))), null);
});

test('a broadcast is still attempted on exactly one server even when servers are benched', async () => {
  clearBench();
  benchFor('https://history.invalid', new Error('HTTP 429'));
  const before = upstreamRequests.length;
  const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/chain/push_transaction`, { method: 'POST', body: '{"signatures":[],"packed_trx":"00"}' });
  assert.equal(response.status, 500);
  assert.equal(upstreamRequests.length - before, 1);
  clearBench();
});

test('YouTube title and picture lookups traverse SOCKS with isolated labels', async () => {
  const before = destinations.length, start = labels.length;
  const base = `http://127.0.0.1:${proxyPort}`;
  const title = await fetch(`${base}/youtube/title/dQw4w9WgXcQ`);
  assert.deepEqual(await title.json(), { title: 'Song' });
  assert.equal(upstreamRequests.at(-1).url, '/api/v1/videos/dQw4w9WgXcQ?fields=title');
  const picture = await fetch(`${base}/youtube/thumbnail/dQw4w9WgXcQ`);
  assert.equal(picture.headers.get('content-type'), 'image/jpeg');
  assert.equal(picture.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual([...new Uint8Array(await picture.arrayBuffer())], [255, 216, 255]);
  assert.equal(destinations.length - before, 2);
  assert.ok(destinations.slice(before).every(d => d.host === 'history.invalid'));
  assert.notEqual(labels[start], labels[start + 1]);
});
test('YouTube proxy refuses arbitrary hosts, queries, invalid IDs and writes before Tor', async () => {
  const before = destinations.length;
  for (const path of ['/youtube/title/short', '/youtube/title/dQw4w9WgXcQ?host=https://evil', '/youtube/embed/dQw4w9WgXcQ', '/youtube/thumbnail/https://evil']) {
    assert.equal(youtubeRequest(path), null);
    assert.equal((await fetch(`http://127.0.0.1:${proxyPort}${path}`)).status, 403);
  }
  assert.equal((await fetch(`http://127.0.0.1:${proxyPort}/youtube/title/dQw4w9WgXcQ`, { method: 'POST' })).status, 403);
  assert.equal(destinations.length, before);
});

test('video lookup response sizes are bounded', async () => {
  await assert.rejects(requestViaTor(socksPort, 'https://history.invalid', '/api/v1/videos/dQw4w9WgXcQ?fields=title', { ca, maxResponseBytes: 8 }), /response too large/);
});
