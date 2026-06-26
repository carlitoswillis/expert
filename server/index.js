const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const config = require('./config');
const store = require('./store');
const { extractPdfText } = require('./extract');

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

// --- API --------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', store: store.driver, time: new Date().toISOString() });
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

      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const content = await extractPdfText(file.path);
        const displayName = course ? `${course} – ${file.originalname}` : file.originalname;
        // eslint-disable-next-line no-await-in-loop
        const record = await store.create({
          title: title || file.originalname.replace(/\.pdf$/i, ''),
          authors: authors || '',
          url: url || '',
          published: published || '',
          fileName: displayName,
          created,
          content,
        });
        records.push({ id: record.id, title: record.title, fileName: record.fileName });
      }
      return res.json({ message: 'uploaded', count: records.length, records });
    } catch (e) {
      console.error('[upload]', e);
      return res.status(500).json({ error: e.message });
    }
  });
});

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
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`expert search → http://localhost:${config.port}  (store: ${store.driver})`);
  });
}

module.exports = app;
