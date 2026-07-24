const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const config = require('./config');
const store = require('./store');
const { extractPdfText } = require('./extract');
const capture = require('./capture');
const metadata = require('./metadata');
const jobs = require('./jobs');

const isPdf = (name) => /\.pdf$/i.test(name || '');
const isHtml = (name) => /\.x?html?$/i.test(name || '');
const textLength = (s) => String(s || '').replace(/\s/g, '').length;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the built Vite client (client/dist) when it exists.
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');

// --- File uploads -----------------------------------------------------------
fs.mkdirSync(config.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.uploadDir),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/\s+/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
}).array('myFile');

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Persist a non-PDF capture and, when a provider is configured, let the LLM
// fill whatever the source didn't give us — only ever the blank fields, and
// only those the caller says make sense for that kind of source.
async function saveCapture(record, enrichable = jobs.fields) {
  const missing = enrichable.filter((f) => !String(record[f] || '').trim());
  const willEnrich = Boolean(record.content) && missing.length > 0 && metadata.enabled();
  const created = new Date().toDateString();
  const saved = await store.create({
    ...record,
    url: record.url || '',
    created,
    status: willEnrich ? 'processing' : 'ready',
  });
  if (willEnrich) {
    jobs.enqueue(store, saved.id, null, { needsOcr: false, content: record.content, missing });
  }
  return saved;
}

// --- API --------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    store: store.driver,
    jobs: jobs.stats(),
    time: new Date().toISOString(),
  });
});

app.get('/sources', asyncRoute(async (req, res) => {
  res.json(await store.list(req.query));
}));

app.get('/sources/:id', asyncRoute(async (req, res) => {
  const source = await store.get(req.params.id);
  if (!source) return res.status(404).json({ error: 'not found' });
  return res.json(source);
}));

app.post('/sources', (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const files = req.files || [];
      const { title, authors, url, published, course } = req.body;
      const created = new Date().toDateString();
      const records = [];

      // Which metadata fields the user didn't supply — the LLM may fill these.
      const supplied = { title, authors, published };
      const missing = jobs.fields.filter((f) => !String(supplied[f] || '').trim());

      for (const file of files) {
        // A saved web page ("Save page as…") is a document too — run it through
        // the same readability pass a captured link gets, instead of storing an
        // empty record for it.
        let web = null;
        if (isHtml(file.originalname)) {
          // eslint-disable-next-line no-await-in-loop
          web = await capture.fromHtml(fs.readFileSync(file.path, 'utf8'), {
            fallbackTitle: file.originalname.replace(/\.x?html?$/i, ''),
          });
        }
        // eslint-disable-next-line no-await-in-loop
        const content = web ? web.content : await extractPdfText(file.path);
        // A scanned/image PDF has no text layer, so pdf-parse comes back empty:
        // OCR it in the background instead of blocking upload.
        const needsOcr = isPdf(file.originalname) && textLength(content) < config.ocr.minChars;

        const values = {
          title: title || (web && web.title) || file.originalname.replace(/\.pdf$/i, ''),
          authors: authors || (web ? web.authors : ''),
          published: published || (web ? web.published : ''),
        };
        // A PDF's title defaults to its filename — a placeholder, not a real
        // title — so enrichment is keyed off what the *user* left blank. A
        // saved page's extracted title is genuine, so only true blanks count
        // and the LLM never overwrites what readability already found.
        const gaps = web
          ? jobs.fields.filter((f) => !String(values[f] || '').trim())
          : missing;
        // Enrich missing Title/Authors/Year from the text when a provider exists.
        const willEnrich = (isPdf(file.originalname) || web)
          && gaps.length > 0 && metadata.enabled();
        const processing = needsOcr || willEnrich;
        const displayName = course ? `${course} – ${file.originalname}` : file.originalname;
        // eslint-disable-next-line no-await-in-loop
        const record = await store.create({
          type: web ? 'web' : (isPdf(file.originalname) ? 'pdf' : 'file'),
          ...values,
          url: url || '',
          sourceUrl: web ? web.sourceUrl : '',
          fileName: displayName,
          created,
          content,
          status: processing ? 'processing' : 'ready',
        });
        if (processing) {
          jobs.enqueue(store, record.id, file.path, { needsOcr, content, missing: gaps });
        }
        records.push({
          id: record.id, title: record.title, fileName: record.fileName, status: record.status,
        });
      }
      const processing = records.filter((r) => r.status === 'processing').length;
      return res.json({
        message: 'uploaded', count: records.length, processing, records,
      });
    } catch (e) {
      console.error('[upload]', e);
      return res.status(500).json({ error: e.message });
    }
  });
});

// Capture a web article by link: readability extraction, with a raw-HTML
// fallback so gated/JS-heavy pages still land in the library.
app.post('/sources/url', asyncRoute(async (req, res) => {
  const record = await capture.fromUrl(req.body.url);
  const saved = await saveCapture(record);
  return res.json({ message: 'captured', record: saved });
}));

// Capture pasted text / a note.
app.post('/sources/text', asyncRoute(async (req, res) => {
  const record = capture.fromText(req.body);
  // Notes skip LLM enrichment entirely: the user wrote the text, so there's no
  // bibliographic author or year to recover, and guessing at one would be
  // worse than the blank. A note saves instantly and is searchable at once.
  const saved = await saveCapture(record, []);
  return res.json({ message: 'captured', record: saved });
}));

app.put('/sources/:id', asyncRoute(async (req, res) => {
  const updated = await store.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  return res.json(updated);
}));

app.delete('/sources/:id', asyncRoute(async (req, res) => {
  const ok = await store.remove(req.params.id);
  return res.json({ deleted: ok });
}));

// --- Client (SPA) -----------------------------------------------------------
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('*', (req, res) => res.status(503).send(
    'Client not built. Run `npm run build`, or `npm run client:dev` for the dev server.',
  ));
}

// --- Error handler ----------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Capture paths attach a `status` for user-fixable problems (bad URL, empty
  // paste); everything else is a genuine 500.
  const status = Number(err.status) || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || 'internal error' });
});

// Background jobs live only in memory, so anything left 'processing' when the
// process died is stranded: the UI dims those cards and disables their actions
// forever. At boot, settle them by what they actually have — text means ready,
// no text means the extraction failed.
async function recoverStaleJobs() {
  const { results } = await store.list({ limit: 1000 });
  const stale = results.filter((r) => r.status === 'processing');
  await Promise.all(stale.map(async (row) => {
    const full = await store.get(row.id);
    await store.update(row.id, { status: full && full.content ? 'ready' : 'failed' });
  }));
  if (stale.length) console.log(`[jobs] recovered ${stale.length} interrupted source(s)`);
}

if (require.main === module) {
  recoverStaleJobs().catch((err) => console.error('[jobs] recovery failed:', err.message));
  app.listen(config.port, () => {
    console.log(`expert search → http://localhost:${config.port}  (store: ${store.driver})`);
  });
}

module.exports = app;
