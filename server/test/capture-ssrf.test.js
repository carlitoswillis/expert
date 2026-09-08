// Regression tests for the URL-capture SSRF guard.
//
// The hole these cover: validating only the URL the user typed is not enough.
// The fetch has to be ours, and the address check has to happen on the socket,
// or an attacker's public host can 302 into the internal network (and a
// short-TTL record can answer public for the check and private for the
// connection).  Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const dns = require('node:dns');
const http = require('node:http');
const os = require('node:os');

const { isPrivateAddress } = require('../safeFetch');
const capture = require('../capture');

// ---------------------------------------------------------------------------
test('address classifier: internal ranges are refused, public ones are not', () => {
  const private_ = [
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '192.0.0.1', '198.18.0.1',
    '::1', '::', '::7f00:1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
    'fe80::1', 'fec0::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '2002:7f00:1::1',      // 6to4 wrapping 127.0.0.1
    '64:ff9b::a00:1',      // NAT64 wrapping 10.0.0.1
    'not-an-address', '',
  ];
  const public_ = [
    '8.8.8.8', '93.184.216.34', '172.32.0.1', '172.15.0.1', '99.99.99.99',
    '2001:4860:4860::8888', '2607:f8b0:4005:80a::200e',
    '::ffff:8.8.8.8', '2002:808:808::1', '64:ff9b::808:808',
  ];
  for (const ip of private_) assert.equal(isPrivateAddress(ip), true, `${ip} should be refused`);
  for (const ip of public_) assert.equal(isPrivateAddress(ip), false, `${ip} should be allowed`);
});

// ---------------------------------------------------------------------------
test('fromUrl refuses internal and non-http targets', async (t) => {
  const refused = [
    ['http://127.0.0.1:9/', 'loopback literal'],
    ['http://[::1]:9/', 'loopback IPv6 literal'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['http://10.0.0.1/', 'RFC1918'],
    ['http://[::ffff:127.0.0.1]/', 'v4-mapped loopback'],
    ['file:///etc/passwd', 'file scheme'],
    ['gopher://example.com/', 'non-http scheme'],
    ['not-a-url', 'malformed'],
  ];
  for (const [url, why] of refused) {
    await assert.rejects(
      () => capture.fromUrl(url),
      (err) => err.status === 400,
      `${why} (${url}) must be refused with a 400`,
    );
  }
});

// ---------------------------------------------------------------------------
// The redirect hop can only be exercised end to end if this machine has an
// address the guard considers public and can still connect to (its own global
// IPv6, typically). Without one there is no way to make hop 1 legitimately
// pass, so the test reports itself skipped rather than passing vacuously.
function publicLocalAddress() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (!a.internal && !isPrivateAddress(a.address)) return a;
    }
  }
  return null;
}

const listen = (srv, port, host) => new Promise((ok, no) => {
  srv.once('error', no);
  srv.listen(port, host, ok);
});

test('a public host that redirects to an internal address is stopped at the redirect', async (t) => {
  const local = publicLocalAddress();
  if (!local) return t.skip('no globally routable local address to host the public hop on');

  const SECRET = 'internal-only-credential-material';
  let internalHits = 0;
  const internal = http.createServer((req, res) => {
    internalHits += 1;
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<html><head><title>metadata</title></head><body><article><p>${SECRET}. ${'padding '.repeat(60)}</p></article></body></html>`);
  });
  const edge = http.createServer((req, res) => {
    if (req.url === '/open') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><head><title>Public article</title></head><body><article><p>${'A perfectly ordinary public page that must still capture. '.repeat(6)}</p></article></body></html>`);
      return;
    }
    const target = req.url === '/to-internal'
      ? 'http://127.0.0.1:9098/latest/meta-data/'
      : `http://edge.test:9099/open`;
    res.writeHead(302, { location: target });
    res.end();
  });

  // Stand in for an attacker-controlled public hostname. The two resolver
  // views agree, so this exercises the redirect, not rebinding.
  const realLookup = dns.lookup;
  dns.lookup = (host, options, cb) => {
    const opts = typeof options === 'function' ? {} : (options || {});
    const done = typeof options === 'function' ? options : cb;
    if (host === 'edge.test') {
      const addrs = [{ address: local.address, family: local.family === 'IPv6' ? 6 : 4 }];
      return process.nextTick(() => (opts.all ? done(null, addrs) : done(null, addrs[0].address, addrs[0].family)));
    }
    return realLookup(host, options, cb);
  };

  try {
    await listen(internal, 9098, '127.0.0.1');
    await listen(edge, 9099, local.address);
  } catch (err) {
    dns.lookup = realLookup;
    internal.close(); edge.close();
    return t.skip(`could not bind the test servers: ${err.message}`);
  }

  try {
    await assert.rejects(
      () => capture.fromUrl('http://edge.test:9099/to-internal'),
      (err) => err.status === 400 && /private or local/.test(err.message),
      'a 302 into the internal network must be refused',
    );
    assert.equal(internalHits, 0, 'the internal service must never be contacted');

    // ...and a redirect between public hosts must still be followed.
    const ok = await capture.fromUrl('http://edge.test:9099/to-public');
    assert.equal(ok.title, 'Public article');
    assert.ok(ok.content.includes('perfectly ordinary public page'), 'public redirect should still capture');
    assert.equal(ok.sourceUrl, 'http://edge.test:9099/to-public');
  } finally {
    dns.lookup = realLookup;
    internal.close();
    edge.close();
  }
});

// ---------------------------------------------------------------------------
test('DNS rebinding: an answer that turns internal at connect time is refused', async (t) => {
  const local = publicLocalAddress();
  if (!local) return t.skip('no globally routable local address to answer with');

  let hits = 0;
  const internal = http.createServer((req, res) => {
    hits += 1;
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<html><body><article><p>${'internal only. '.repeat(30)}</p></article></body></html>`);
  });
  await listen(internal, 9098, '127.0.0.1');

  // Two resolver views of the same name, which is what a short-TTL record buys
  // an attacker: whatever resolves the name for *validation* sees a public
  // address, while whatever resolves it for the *connection* sees loopback.
  // The check therefore has to live inside the connection's own lookup.
  const realLookup = dns.lookup;
  const realPromisesLookup = dns.promises.lookup;
  const publicAnswer = [{ address: local.address, family: local.family === 'IPv6' ? 6 : 4 }];
  dns.lookup = (host, options, cb) => {
    const opts = typeof options === 'function' ? {} : (options || {});
    const done = typeof options === 'function' ? options : cb;
    if (host === 'rebind.test') {
      const addrs = [{ address: '127.0.0.1', family: 4 }];
      return process.nextTick(() => (opts.all ? done(null, addrs) : done(null, addrs[0].address, 4)));
    }
    return realLookup(host, options, cb);
  };
  dns.promises.lookup = async (host, options) => {
    if (host === 'rebind.test') return options && options.all ? publicAnswer : publicAnswer[0];
    return realPromisesLookup(host, options);
  };

  try {
    await assert.rejects(
      () => capture.fromUrl('http://rebind.test:9098/'),
      (err) => err.status >= 400,
      'a host that resolves internal at connect time must not be fetched',
    );
    assert.equal(hits, 0, 'the internal service must never be contacted');
  } finally {
    dns.lookup = realLookup;
    dns.promises.lookup = realPromisesLookup;
    internal.close();
  }
});
