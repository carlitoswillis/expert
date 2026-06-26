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

function enqueue(store, id, filePath, opts) {
  Promise.resolve()
    .then(() => run(store, id, filePath, opts))
    .catch((err) => {
      console.error(`[jobs] source ${id} failed:`, err.message);
      return store.update(id, { status: 'failed' }).catch(() => {});
    });
}

module.exports = { enqueue, fields: metadata.fields };
