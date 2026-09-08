const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const zlib = require('zlib');

// SSRF guard for every outbound request made on behalf of a caller-supplied
// URL (today: the URL-capture endpoint).
//
// The trust boundary is the SOCKET, not the URL string. Two things follow from
// that, and both were holes when the check lived next to the caller:
//
//  1. Validating only the first URL is useless if something else performs the
//     fetch. Any library that calls fetch() gets redirect:'follow' by default,
//     so one 302 from an attacker's public host walks straight into the
//     internal network. Redirects are therefore followed by hand here, one
//     validated request per hop, and the fetch is never delegated.
//  2. Resolving a hostname to a public address and then handing the *hostname*
//     to the transport lets it resolve again — a short-TTL record answers
//     public for the check and private for the connection (DNS rebinding). So
//     the check runs inside the connection's own DNS lookup: the address that
//     is validated is the address that is connected to, with no second
//     resolution in between.

const MAX_REDIRECTS = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20000;

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0';

const denied = (message) => Object.assign(new Error(message), { status: 400 });

// ---------------------------------------------------------------- addresses

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;   // this-host, RFC1918, loopback, multicast/reserved
  if (a === 169 && b === 254) return true;                          // link-local, incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true;                 // RFC1918
  if (a === 192 && b === 168) return true;                          // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true;                // CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true;          // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true;             // benchmarking
  return false;
}

// Expand an IPv6 literal to its 16 bytes, or null if it isn't one.
function ipv6Bytes(ip) {
  const value = String(ip).toLowerCase().split('%')[0];
  if (net.isIP(value) !== 6) return null;
  const compressed = value.includes('::');
  const [headPart, tailPart] = compressed ? value.split('::') : [value, ''];
  const split = (part) => (part ? part.split(':') : []);
  // Each group is 2 bytes, except a trailing dotted quad, which is 4.
  const toBytes = (groups) => {
    const out = [];
    for (const g of groups) {
      if (g.includes('.')) {
        if (net.isIP(g) !== 4) return null;
        out.push(...g.split('.').map(Number));
      } else {
        const n = parseInt(g, 16);
        if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
        out.push(n >> 8, n & 0xff);
      }
    }
    return out;
  };
  const head = toBytes(split(headPart));
  const tail = toBytes(split(tailPart));
  if (!head || !tail) return null;
  const fill = 16 - head.length - tail.length;
  if (fill < 0 || (!compressed && fill !== 0)) return null;
  return [...head, ...Array(fill).fill(0), ...tail];
}

// Allow-list shape: only 2000::/3 global unicast is public, and the ranges that
// tunnel an IPv4 address (6to4, NAT64) are judged by the address they carry.
function isPrivateIPv6(ip) {
  const b = ipv6Bytes(ip);
  if (!b) return true;
  const v4 = (o) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
  // ::ffff:a.b.c.d (v4-mapped) and ::a.b.c.d (v4-compatible, deprecated)
  const firstTenZero = b.slice(0, 10).every((x) => x === 0);
  if (firstTenZero && b[10] === 0xff && b[11] === 0xff) return isPrivateIPv4(v4(12));
  if (b.slice(0, 12).every((x) => x === 0)) return true; // ::, ::1, ::a.b.c.d — never routable for us
  if (b[0] === 0x20 && b[1] === 0x02) return isPrivateIPv4(v4(2)); // 6to4 2002::/16
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return isPrivateIPv4(v4(12)); // NAT64 64:ff9b::/96
  return (b[0] & 0xe0) !== 0x20; // anything outside 2000::/3 is not global unicast
}

function isPrivateAddress(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // couldn't tell — refuse rather than risk it
}

const BLOCKED = 'That URL points at a private or local address.';

// ------------------------------------------------------------------- lookup

// Node calls this for the connection's own DNS resolution, so the address it
// returns is the address the socket connects to. No window between check and
// connect, and every redirect hop goes through it again.
function guardedLookup(hostname, options, callback) {
  const opts = typeof options === 'function' ? {} : (options || {});
  const cb = typeof options === 'function' ? options : callback;
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    if (!list.length) return cb(denied(BLOCKED));
    // If ANY answer is internal, refuse the host outright: a split answer is
    // the rebinding attack, not a reason to pick the other address.
    if (list.some((a) => isPrivateAddress(a.address))) return cb(denied(BLOCKED));
    if (opts.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
}

// A bare IP in the URL never reaches guardedLookup, so classify it here.
function assertPublicHostname(hostname) {
  const bare = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  if (net.isIP(bare) && isPrivateAddress(bare)) throw denied(BLOCKED);
  return bare;
}

// -------------------------------------------------------------------- fetch

function parseHttpUrl(raw, base) {
  let parsed;
  try {
    parsed = base ? new URL(raw, base) : new URL(String(raw || '').trim());
  } catch {
    throw denied('That doesn\'t look like a URL.');
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw denied('Only http and https links can be captured.');
  }
  return parsed;
}

function decompress(buffer, encoding) {
  const enc = String(encoding || '').toLowerCase();
  try {
    if (enc.includes('br')) return zlib.brotliDecompressSync(buffer);
    if (enc.includes('gzip')) return zlib.gunzipSync(buffer);
    if (enc.includes('deflate')) return zlib.inflateSync(buffer);
  } catch {
    return buffer; // served a bad body; hand back what we got
  }
  return buffer;
}

// Keep transport failures user-facing: a typo'd host stayed a 400 when the
// guard resolved names itself, and it must stay one now that resolution
// happens inside the connection.
const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EAI_NODATA', 'EAI_NONAME']);
function networkError(err) {
  if (err && err.status) return err;
  if (err && DNS_CODES.has(err.code)) return denied('That URL could not be resolved.');
  return Object.assign(new Error('That page could not be loaded.'), { status: 502, cause: err });
}

function requestOnce(url) {
  const bare = assertPublicHostname(url.hostname);
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: bare,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        lookup: guardedLookup,
        headers: {
          host: url.host,
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en-US,en;q=0.9',
        },
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(Object.assign(new Error('That page is too large to capture.'), { status: 502 }));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: decompress(Buffer.concat(chunks), res.headers['content-encoding']),
        }));
        res.on('error', (err) => reject(networkError(err)));
      },
    );
    const tooSlow = Object.assign(new Error('That page took too long to load.'), { status: 504 });
    // Both an inactivity timeout and a hard deadline: a slow drip must not be
    // able to hold a connection open indefinitely.
    req.setTimeout(TIMEOUT_MS, () => req.destroy(tooSlow));
    const deadline = setTimeout(() => req.destroy(tooSlow), TIMEOUT_MS * 2);
    deadline.unref();
    req.on('close', () => clearTimeout(deadline));
    req.on('error', (err) => reject(networkError(err)));
    req.end();
  });
}

/**
 * Fetch a caller-supplied URL with the private-address guard applied to every
 * hop's own connection. Returns { url, status, headers, body } where `url` is
 * the address the body actually came from.
 */
async function safeFetch(rawUrl, { redirects = MAX_REDIRECTS } = {}) {
  let url = parseHttpUrl(rawUrl);
  for (let hop = 0; hop <= redirects; hop += 1) {
    const res = await requestOnce(url);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.location;
      if (!location || hop === redirects) {
        throw Object.assign(new Error('Too many redirects.'), { status: 502 });
      }
      // Re-parsed (protocol re-checked) and re-connected through guardedLookup.
      url = parseHttpUrl(location, url.href);
      continue;
    }
    if (res.status >= 400) {
      throw Object.assign(new Error(`The page returned ${res.status}.`), { status: 502 });
    }
    return { url: url.href, status: res.status, headers: res.headers, body: res.body };
  }
  throw Object.assign(new Error('Too many redirects.'), { status: 502 });
}

// Content-Type first, then the document's own <meta charset>.
function decodeBody(buffer, contentType) {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(String(contentType || ''));
  const head = buffer.subarray(0, 4096).toString('latin1');
  const fromMeta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head);
  const charset = (fromHeader?.[1] || fromMeta?.[1] || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
}

module.exports = {
  safeFetch,
  decodeBody,
  parseHttpUrl,
  isPrivateAddress,
  isPrivateIPv4,
  isPrivateIPv6,
};
