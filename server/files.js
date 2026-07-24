const fs = require('fs');
const path = require('path');

const config = require('./config');

// Map a stored source to its uploaded file on disk.
//
// New uploads record the exact disk name in `fileID`. Everything imported
// before that (the whole bulk-imported library) only kept the *display* name —
// possibly prefixed with a course ("COG SCI C142 – 34-everett-2005.pdf") —
// while multer wrote "<timestamp>-<original name, spaces→underscores>". The
// fallback strips both decorations and matches on what's left; when several
// timestamps match (re-uploads), the newest wins.

const norm = (name) => String(name).replace(/\s+/g, '_').toLowerCase();

// The display name minus any "<course> – " prefix the upload form added.
function baseName(fileName) {
  const i = String(fileName).lastIndexOf(' – ');
  return i === -1 ? fileName : fileName.slice(i + 3);
}

// One readdir per burst of lookups (a list page resolves ~10 rows at once).
let cache = { at: 0, entries: [] };
function entries() {
  if (Date.now() - cache.at > 2000) {
    let listing = [];
    try {
      listing = fs.readdirSync(config.uploadDir);
    } catch {
      // No uploads directory yet — nothing to resolve against.
    }
    cache = { at: Date.now(), entries: listing };
  }
  return cache.entries;
}

/** Absolute path of the record's stored file, or null when none exists. */
function resolveFile(record) {
  if (!record) return null;
  if (record.fileID) {
    const exact = path.join(config.uploadDir, path.basename(record.fileID));
    if (fs.existsSync(exact)) return exact;
  }
  if (!record.fileName) return null;
  const want = norm(baseName(record.fileName));
  const hits = entries().filter((f) => norm(f.replace(/^\d+-/, '')) === want);
  if (!hits.length) return null;
  // The timestamp prefix is fixed-width, so lexicographic order is
  // chronological: the last hit is the most recent upload.
  hits.sort();
  return path.join(config.uploadDir, hits[hits.length - 1]);
}

module.exports = { resolveFile };
