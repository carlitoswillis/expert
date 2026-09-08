const { normalize } = require('./extract');
const { safeFetch, decodeBody, parseHttpUrl } = require('./safeFetch');

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
  return parseHttpUrl(raw).href;
}

const yearOf = (value) => {
  const match = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(String(value || ''));
  return match ? match[1] : '';
};

// The one place this module touches the network. Every hop is validated at its
// own socket by safeFetch, and the extractor is never handed a URL — it only
// ever sees HTML we fetched ourselves — so no library gets to follow a redirect
// on our behalf.
async function fetchPage(url) {
  const res = await safeFetch(url);
  return { html: decodeBody(res.body, res.headers['content-type']), url: res.url };
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
 * Capture a web article. Fetches the page through the SSRF-guarded fetcher,
 * then runs the same readability-then-raw pass as fromHtml, so a paywalled or
 * unusual page still lands in the library.
 * Returns a record ready for store.create(), minus server-managed fields.
 */
async function fromUrl(rawUrl) {
  const url = parseUrl(rawUrl);
  const page = await fetchPage(url);
  // Relative links resolve against where the body really came from; the record
  // still points at the address the user asked for.
  const record = await fromHtml(page.html, { url: page.url || url });

  return {
    ...record,
    title: record.title || new URL(url).hostname,
    sourceUrl: url,
    fileName: '',
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
