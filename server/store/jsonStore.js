const fs = require('fs');
const path = require('path');

const { dataDir, fields } = require('../config');

// Zero-config persistence: a single JSON file on disk. Good enough for local
// dev and small personal libraries. Mirrors the substring ("LIKE %q%") search
// semantics of the original MySQL implementation.

const FILE = path.join(dataDir, 'sources.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { sources: [], nextId: 1 };
  }
}

function persist(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  // Write to a temp file then rename for a crash-safe-ish swap.
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

// Fold case and diacritics so "Piraha" finds "Pirahã" and vice versa. Real
// libraries mix the two constantly — OCR drops accents, authors transliterate,
// and nobody types ã on the way to a search box. (MySQL's default collation is
// already accent-insensitive, so this keeps the two drivers behaving alike.)
const fold = (value) => String(value || '')
  .normalize('NFD')
  // U+0300–U+036F: the combining diacritical marks NFD splits off.
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const has = (value, term) => fold(value).includes(fold(term));

// Records created before `type` existed still need a bucket to filter on.
function typeOf(row) {
  if (row.type) return row.type;
  if (row.sourceUrl) return 'web';
  if (/\.pdf$/i.test(row.fileName || '')) return 'pdf';
  return 'source';
}

function matches(row, query) {
  const { q, authors, title, fileName, content, type } = query;
  // `type` narrows every other mode of search rather than replacing it.
  if (type && typeOf(row) !== type) return false;
  if (q) {
    return has(row.content, q) || has(row.title, q) || has(row.authors, q) || has(row.fileName, q);
  }
  const filters = [['authors', authors], ['title', title], ['fileName', fileName], ['content', content]]
    .filter(([, term]) => term);
  // AND across every provided field filter; no filters means "match all".
  return filters.every(([field, term]) => has(row[field], term));
}

async function list(query = {}) {
  const { sources } = load();
  const page = Number(query.page) || 0;
  const limit = Number(query.limit) || 10;

  const filtered = sources
    .filter((row) => matches(row, query))
    .sort((a, b) => b.id - a.id);

  const start = page * limit;
  const results = filtered.slice(start, start + limit)
    // Don't ship the full extracted text in list responses; it can be huge.
    .map(({ content, ...rest }) => rest);

  return { results, count: filtered.length };
}

async function get(id) {
  const { sources } = load();
  return sources.find((row) => row.id === Number(id)) || null;
}

// Allow-list against `config.fields`, same as mysqlStore — otherwise a bare
// `PUT /sources/:id` (which passes req.body straight through) can write any
// key the caller likes into the record.
const allowed = (patch) => Object.fromEntries(
  Object.entries(patch).filter(([c]) => fields.includes(c)),
);

async function create(record) {
  const state = load();
  const row = { ...allowed(record), id: state.nextId };
  state.sources.push(row);
  state.nextId += 1;
  persist(state);
  return row;
}

async function update(id, patch) {
  const state = load();
  const row = state.sources.find((r) => r.id === Number(id));
  if (!row) return null;
  Object.assign(row, allowed(patch), { id: row.id });
  persist(state);
  return row;
}

async function remove(id) {
  const state = load();
  const before = state.sources.length;
  state.sources = state.sources.filter((r) => r.id !== Number(id));
  persist(state);
  return state.sources.length < before;
}

module.exports = { list, get, create, update, remove, driver: 'json' };
