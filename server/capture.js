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

const yearOf = (value) => {
  const match = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(String(value || ''));
  return match ? match[1] : '';
};

// Last resort when the readability pass finds no article: take the raw HTML.
async function rawFetch(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; expert/2.1; +local library capture)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`The page returned ${res.status} ${res.statusText}.`), { status: 502 });
  }
  const html = await res.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return { title: title ? collapse(stripHtml(title[1])) : '', content: htmlToText(html) };
}

/**
 * Capture a web article. Tries readability extraction first and falls back to
 * the raw page, so a paywalled or unusual page still lands in the library.
 * Returns a record ready for store.create(), minus server-managed fields.
 */
async function fromUrl(rawUrl) {
  const url = parseUrl(rawUrl);

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

module.exports = { fromUrl, fromText, htmlToText };
