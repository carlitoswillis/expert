const fs = require('fs');

const config = require('./config');
const { normalize } = require('./extract');

// OCR fallback for scanned/image PDFs — the ones a text-layer extractor
// (pdf-parse) returns nothing for. Two pure-WASM steps, so there are no native
// binaries to install (the reason the old poppler/ghostscript/tesseract
// pipeline rotted):
//   1. mupdf rasterizes each PDF page to a PNG.
//   2. tesseract.js recognizes text in that PNG.
//
// Both libs are ESM-only, so they're pulled in lazily via dynamic import the
// first time a scan actually needs OCR (keeps server startup cheap and avoids
// loading ~tens of MB of WASM for users who only have text PDFs).

let mupdfPromise;
function getMupdf() {
  if (!mupdfPromise) mupdfPromise = import('mupdf');
  return mupdfPromise;
}

// --- Shared tesseract worker pool -------------------------------------------
// A fixed set of long-lived workers shared across every OCR job. recognize()
// hands a page image to the next idle worker (or waits for one), which both
// caps total concurrency and keeps pages flowing in parallel — so several
// pages (and several documents) get read at once without spawning a worker
// per page.
class WorkerPool {
  constructor(size) {
    this.size = Math.max(1, size);
    this.workers = null;
    this.idle = [];
    this.waiters = [];
  }

  async init() {
    if (this.workers) return;
    const { createWorker } = await import('tesseract.js');
    this.workers = await Promise.all(
      Array.from({ length: this.size }, () => createWorker('eng')),
    );
    this.idle = [...this.workers];
  }

  acquire() {
    if (this.idle.length) return Promise.resolve(this.idle.pop());
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(worker) {
    const next = this.waiters.shift();
    if (next) next(worker);
    else this.idle.push(worker);
  }

  async recognize(image) {
    await this.init();
    const worker = await this.acquire();
    try {
      const { data } = await worker.recognize(image);
      return data.text;
    } finally {
      this.release(worker);
    }
  }
}

let pool;
function getPool() {
  if (!pool) pool = new WorkerPool(config.ocr.concurrency);
  return pool;
}

// Rasterize every page of a PDF to a PNG buffer.
async function rasterize(buffer, dpi) {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const scale = mupdf.Matrix.scale(dpi / 72, dpi / 72);
  const pages = [];
  const count = doc.countPages();
  for (let i = 0; i < count; i += 1) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(scale, mupdf.ColorSpace.DeviceRGB, false);
    pages.push(Buffer.from(pixmap.asPNG()));
    pixmap.destroy();
    page.destroy();
  }
  doc.destroy();
  return pages;
}

/**
 * OCR a scanned PDF into normalized text. Pages are recognized in parallel
 * through the shared worker pool. Returns '' on failure (never throws) so a
 * bad scan still leaves the record in a sane state.
 */
async function ocrPdf(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const images = await rasterize(buffer, config.ocr.dpi);
    if (!images.length) return '';
    const p = getPool();
    const pages = await Promise.all(images.map((img) => p.recognize(img)));
    return normalize(pages.join('\n'));
  } catch (err) {
    console.error(`[ocr] failed for ${filePath}:`, err.message);
    return '';
  }
}

// Orchestration (run in background, flip status when done) lives in server/jobs.js.
module.exports = { ocrPdf };
