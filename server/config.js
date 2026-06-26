require('dotenv').config();

const os = require('os');
const path = require('path');

// A record's persisted fields. `id` and `created` are server-managed.
// `type` tags how the source was captured (pdf | web | note | youtube | epub
// | image | audio); `sourceUrl` is its origin (article/video link); `content`
// is the extracted, searchable full text.
const FIELDS = [
  'type',
  'authors',
  'title',
  'content',
  'created',
  'published',
  'url',
  'sourceUrl',
  'fileID',
  'driveLink',
  'fileName',
  // Lifecycle of the extracted text: 'ready' (searchable) or 'processing'
  // (scanned PDF still being OCR'd in the background) or 'failed'.
  'status',
];

const config = {
  port: Number(process.env.PORT) || 3000,

  // Where the new pure-JS pipeline writes uploaded files.
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'uploads'),

  // JSON store location (used when no MySQL config is present).
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, '..', 'data'),

  // Storage driver: "mysql" if DB_HOST is set, otherwise "json".
  // The JSON store needs zero external services, so the app runs out of the box.
  useMysql: Boolean(process.env.DB_HOST),

  mysql: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB || 'my_db',
    port: Number(process.env.DB_PORT) || 3306,
  },

  fields: FIELDS,

  // OCR fallback for scanned/image PDFs (no text layer). Pure-WASM pipeline:
  // mupdf rasterizes pages, tesseract.js reads them. Runs in the background.
  ocr: {
    // How many PDFs to OCR at once. Default leaves a core free; tune up on a
    // big machine via OCR_CONCURRENCY (each worker is its own WASM instance).
    concurrency: Number(process.env.OCR_CONCURRENCY)
      || Math.max(1, Math.min(6, os.cpus().length - 1)),
    // Render resolution. 200dpi is a good accuracy/speed balance for OCR.
    dpi: Number(process.env.OCR_DPI) || 200,
    // If pdf-parse yields fewer than this many non-space chars, treat the PDF
    // as a scan and fall back to OCR.
    minChars: Number(process.env.OCR_MIN_CHARS) || 40,
  },

  // LLM-assisted metadata: pull Title / Authors / Year out of a source's text
  // when the user didn't supply them. Best-effort, background, fully optional —
  // with no provider configured the app behaves exactly as before. Provider
  // cascade (first that answers wins): Gemini → Gemma (both Google's free API
  // via GEMINI_API_KEY) → a local Ollama model.
  metadata: {
    geminiKey: process.env.GOOGLE_AI_API_KEY
      || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    // "A higher but free Google LLM" as primary, Gemma as the cheaper fallback.
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    gemmaModel: process.env.GEMMA_MODEL || 'gemma-4-31b-it',
    // Local last resort. OLLAMA_API_BASE is already exported on this machine.
    ollamaBase: process.env.OLLAMA_API_BASE || process.env.OLLAMA_HOST || '',
    ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5-coder:14b',
    // Title/authors/year live on the first page; no need to send the whole doc.
    maxChars: Number(process.env.METADATA_MAX_CHARS) || 6000,
    // When the year isn't in the text, look it up via Gemini's Google Search
    // grounding (Gemini-only; counts against the free grounding quota). Off by
    // setting METADATA_YEAR_SEARCH=0.
    searchYear: process.env.METADATA_YEAR_SEARCH !== '0',
  },
};

module.exports = config;
