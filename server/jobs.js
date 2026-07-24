const config = require('./config');
const ocr = require('./ocr');
const metadata = require('./metadata');

// Background processing for a freshly-uploaded source. Two best-effort steps,
// either of which may be skipped:
//   1. OCR a scanned PDF into searchable text (server/ocr.js).
//   2. Fill in Title/Authors/Year the user left blank (server/metadata.js).
// When both are done the record flips from 'processing' to 'ready' (or 'failed'
// if a scan produced no text at all). Fire-and-forget so uploads return fast.

async function run(store, id, filePath, opts) {
  const patch = {};
  let { content } = opts;

  if (opts.needsOcr) {
    content = await ocr.ocrPdf(filePath);
    patch.content = content;
  }

  const missing = opts.missing || [];
  if (missing.length && content && metadata.enabled()) {
    const meta = await metadata.extract(content);
    if (meta) {
      missing.forEach((field) => { if (meta[field]) patch[field] = meta[field]; });
      console.log(`[jobs] source ${id} metadata via ${meta.provider}`);
    }
  }

  // A scan that yielded nothing is a failure; anything else is ready.
  patch.status = opts.needsOcr && !content ? 'failed' : 'ready';
  await store.update(id, patch);
}

// --- Queue -------------------------------------------------------------------
// Uploading a whole course folder enqueues a job per file at once. Without a
// gate they'd all call the LLM simultaneously and mostly come back rate-limited
// (and the failures are best-effort, so the metadata would just silently be
// missing). A small fixed concurrency keeps a bulk import orderly; OCR pages
// have their own pool inside ocr.js.
const pending = [];
let active = 0;

function pump() {
  while (active < config.jobs.concurrency && pending.length) {
    const task = pending.shift();
    active += 1;
    task().finally(() => {
      active -= 1;
      pump();
    });
  }
}

function enqueue(store, id, filePath, opts) {
  pending.push(() => run(store, id, filePath, opts).catch((err) => {
    console.error(`[jobs] source ${id} failed:`, err.message);
    return store.update(id, { status: 'failed' }).catch(() => {});
  }));
  pump();
}

// How much work is still outstanding — used by the bulk-import script to know
// when an ingest has fully settled.
const stats = () => ({ active, queued: pending.length });

module.exports = { enqueue, stats, fields: metadata.fields };
