const dns = require('dns').promises;
const net = require('net');

const { normalize } = require('./extract');

// Non-PDF capture. Turns a web page or a pasted note into the same shape the
// upload path produces, so everything downstream (store, search, metadata
// enrichment) is unchanged. Best-effort like extract.js: a page that resists
// parsing still yields a record, just with less text.

// @extractus/article-extractor is ESM-only and the server is CommonJS, so it's
// pulled in with a dynamic import, cached after the first call.
let extractorPromise = null;
const loadExtractor = () => {
  if (!extractorPromise) extractorPromise = import('@extractus/article-extractor');
  return extractorPromise;
};

// Whitespace-only cleanup. Titles and author names must NOT go through
// extract.js's normalize(), whose PDF de-hyphenation would turn
// "Qualia - Wikipedia" into "Qualia Wikipedia".
const collapse = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'",
};

// Tags and entities out; whitespace left alone so callers can pick their own
// cleanup (normalize() for body text, collapse() for titles).
const stripHtml = (html) => String(html || '')
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  // Keep block boundaries from gluing words together.
  .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    const key = code.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    const num = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return Number.isFinite(num) ? String.fromCodePoint(num) : ' ';
  });

// The extractor hands back an HTML fragment; search wants plain text.
const htmlToText = (html) => normalize(stripHtml(html));

// Only http(s) — no file://, no data: — and normalized so the store gets a
// canonical origin.
function parseUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || '').trim());
  } catch {
    throw Object.assign(new Error('That doesn\'t look like a URL.'), { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw Object.assign(new Error('Only http and https links can be captured.'), { status: 400 });
  }
  return parsed.href;
}

// SSRF guard: the URL-capture endpoint lets any caller make the server fetch
// an arbitrary address, so before every fetch we resolve the hostname and
// reject loopback / RFC1918 / link-local (incl. the 169.254.169.254 cloud
// metadata address) / CGNAT targets. `rawFetch` re-checks on every redirect
// hop since a first hop can look public and then bounce somewhere internal.
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();
  if (value === '::1' || value === '::') return true;
  if (value.startsWith('::ffff:')) return isPrivateIPv4(value.slice(7));
  if (/^fe[89ab][0-9a-f]:/.test(value)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(value)) return true; // unique local fc00::/7
  return false;
}

function isPrivateAddress(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // couldn't tell — refuse rather than risk it
}

async function assertPublicHost(rawUrl) {
  const { hostname } = new URL(rawUrl);
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw Object.assign(new Error('That URL could not be resolved.'), { status: 400 });
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw Object.assign(new Error('That URL points at a private or local address.'), { status: 400 });
  }
}

const yearOf = (value) => {
  const match = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(String(value || ''));
  return match ? match[1] : '';
};

// Last resort when the readability pass finds no article: take the raw HTML.
// Redirects are followed by hand (rather than `redirect: 'follow'`) so each
// hop can be re-checked by assertPublicHost — a redirect can retarget an
// already-validated public URL at an internal one.
async function rawFetch(url, redirectsLeft = 5) {
  await assertPublicHost(url);
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; expert/2.1; +local library capture)' },
    signal: AbortSignal.timeout(20000),
  });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get('location');
    if (!location || redirectsLeft <= 0) {
      throw Object.assign(new Error('Too many redirects.'), { status: 502 });
    }
    return rawFetch(new URL(location, url).href, redirectsLeft - 1);
  }
  if (!res.ok) {
    throw Object.assign(new Error(`The page returned ${res.status} ${res.statusText}.`), { status: 502 });
  }
  const html = await res.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return { title: title ? collapse(stripHtml(title[1])) : '', content: htmlToText(html) };
}

// A saved page usually still carries the address it came from.
const canonicalOf = (html) => {
  const rel = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)
    || /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i.exec(html);
  try {
    return rel ? parseUrl(rel[1]) : '';
  } catch {
    return '';
  }
};

/**
 * Capture an HTML document we already have in hand — a "Save page as" file, or
 * a page body we fetched ourselves. Same readability-then-raw fallback as
 * fromUrl, and it recovers the original address from the page's canonical link
 * so the record still points back at its source.
 */
async function fromHtml(html, { url = '', fallbackTitle = '' } = {}) {
  const sourceUrl = url || canonicalOf(html);

  let article = null;
  try {
    const { extractFromHtml } = await loadExtractor();
    article = await extractFromHtml(html, sourceUrl || undefined);
  } catch (err) {
    console.error('[capture] html extraction failed:', err.message);
  }

  let content = htmlToText(article?.content || '');
  // Readability found nothing usable — keep the whole page rather than nothing.
  if (content.length < 200) content = htmlToText(html);

  let title = collapse(article?.title || '');
  if (!title) {
    const tag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    title = tag ? collapse(stripHtml(tag[1])) : '';
  }

  return {
    type: 'web',
    title: title || fallbackTitle,
    authors: collapse(article?.author || ''),
    published: yearOf(article?.published),
    sourceUrl,
    content,
  };
}

/**
 * Capture a web article. Tries readability extraction first and falls back to
 * the raw page, so a paywalled or unusual page still lands in the library.
 * Returns a record ready for store.create(), minus server-managed fields.
 */
async function fromUrl(rawUrl) {
  const url = parseUrl(rawUrl);
  await assertPublicHost(url);

  // Note: @extractus/article-extractor does its own fetch (and follows its
  // own redirects) here, so this only guarantees the *initial* host is
  // public — rawFetch below is the path that also re-validates every hop.
  let article = null;
  try {
    const { extract } = await loadExtractor();
    article = await extract(url, {}, { signal: AbortSignal.timeout(20000) });
  } catch (err) {
    console.error('[capture] article extraction failed for', url, '-', err.message);
  }

  let title = collapse(article?.title || '');
  let content = htmlToText(article?.content || '');
  const authors = collapse(article?.author || '');
  const published = yearOf(article?.published);

  // Readability can return an empty shell on JS-heavy or gated pages.
  if (content.length < 200) {
    const raw = await rawFetch(url);
    if (raw.content.length > content.length) content = raw.content;
    if (!title) title = raw.title;
  }

  return {
    type: 'web',
    title: title || new URL(url).hostname,
    authors,
    published,
    sourceUrl: url,
    fileName: '',
    content,
  };
}

/**
 * Capture pasted text / a note. No network, no parsing — just normalization.
 */
function fromText({ title, text, authors, url } = {}) {
  const content = normalize(text);
  if (!content) {
    throw Object.assign(new Error('Paste some text first.'), { status: 400 });
  }
  return {
    type: 'note',
    // Fall back to the opening words so an untitled note is still recognizable.
    title: collapse(title) || `${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`,
    authors: collapse(authors),
    published: '',
    sourceUrl: url ? parseUrl(url) : '',
    fileName: '',
    content,
  };
}

module.exports = { fromUrl, fromHtml, fromText, htmlToText };
