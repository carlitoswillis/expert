# Architecture

PURPOSE: Technical system design and data flow of the **expert search** application.

## Overview
expert search lets a researcher upload PDFs, automatically extracts their full
text, and exposes a focused substring search over titles, authors, and that
extracted text. The goal is a small, personal, high-signal library search — the
opposite of a flooded web search.

Rebuilt in 2026 (v2.0) from an older webpack/jQuery/React-16 + MySQL stack to a
modern Vite/React-18 client and an Express backend with a pluggable store.

## System Components

### 1. Frontend — `client/`
- **Vite + React 18** (replaces the old webpack 4 + jQuery + axios setup).
- Routes (react-router v6): `/` & `/search` (search), `/library` (browse all),
  `/upload` (add PDFs).
- `src/api.js` is a thin `fetch` wrapper for the API.
- Built to `client/dist`, which the server serves in production. In dev, Vite
  runs on :5173 and proxies `/sources` and `/health` to the API on :3000.

### 2. Data API — `server/`
- **Express 4**, JSON + urlencoded body parsing, async route wrapper, central
  error handler.
- Endpoints:
  - `GET  /health` — liveness + active store driver.
  - `GET  /sources` — list/search (`q`, `type`, `page`, `limit`, field filters).
  - `GET  /sources/:id` — full record (includes extracted `content`).
  - `POST /sources` — multipart upload (`myFile[]` + metadata); extracts text.
  - `POST /sources/url` — capture a web article by link (`type:"web"`).
  - `POST /sources/text` — capture pasted text / a note (`type:"note"`).
  - `PUT  /sources/:id` — update metadata.
  - `DELETE /sources/:id` — delete.
- `server/extract.js` — pure-JS PDF text extraction via `pdf-parse`
  (best-effort; never throws).
- `server/capture.js` — non-PDF capture. It fetches the page itself through
  `safeFetch` and hands the HTML to `@extractus/article-extractor`'s
  `extractFromHtml` (ESM, loaded via dynamic `import` from this CommonJS
  server), falling back to raw HTML stripping when readability finds nothing.
  Produces the same record shape as the upload path.
- `server/safeFetch.js` — the only outbound HTTP the server does on behalf of a
  caller-supplied URL. Drives `http(s).request` directly so redirects are
  followed one validated hop at a time, and installs the private-address check
  as the connection's own DNS `lookup`, so the address that is checked is the
  address that is connected to. Nothing else may fetch a user-supplied URL, and
  no library may be handed one to fetch for itself.
- On boot the server settles any record left `'processing'` by a killed
  process — background jobs are in-memory only, so otherwise they'd be
  stranded (dimmed and un-editable) forever.

### 3. Storage — `server/store/`
Pluggable, chosen at startup by `server/config.js`:
- **`jsonStore.js`** (default, zero-config) — one JSON file at `data/sources.json`.
  Substring (`LIKE %q%`) search in memory. Runs with no external services.
- **`mysqlStore.js`** (when `DB_HOST` is set) — `mysql2` promise pool, **fully
  parameterized** queries. Schema in `database/schema.sql`.
Both implement the same interface: `list / get / create / update / remove`.

### 4. Infrastructure
- `docker-compose.yml` — optional MySQL 8 with the schema auto-loaded.
- `.env` / `.env.example` — config (port, DB_*). No DB vars ⇒ JSON store.

### Legacy (not wired into v2) — `ocr/`
Only the OCR Dockerfile survives from the v1 pipeline; it is the sketch of a
path for OCR of image-only PDFs. `process/` (Google Drive upload, PowerPoint→PDF
conversion, PDF quartile "chopping") and `node-ppt2pdf-master/` were deleted —
they were unreferenced and one of them shelled out to a command built by string
interpolation. See [DECISIONS.md](./DECISIONS.md).

## Data Flow

### Capture
```
PDF(s) ──multipart──▶ POST /sources     ──▶ multer saves to uploads/
                                        ──▶ extract.js (pdf-parse → text)
link   ──JSON───────▶ POST /sources/url ──▶ capture.fromUrl (readability,
                                            raw-HTML fallback)
text   ──JSON───────▶ POST /sources/text──▶ capture.fromText (normalize)
        ──▶ store.create({ type, title, authors, …, content })
        ──▶ jobs.enqueue (background OCR and/or LLM metadata, when applicable)
```

### Search
```
query ──▶ GET /sources?q=…&page=&limit= ──▶ store.list()
      ──▶ substring match over content/title/authors/fileName, id DESC, paged
      ──▶ { results: [...without content...], count }
```

## AI Workspace Substrate
This repo uses an AI-assisted engineering substrate in `/ai`:
- **State & tasks**: [PROJECT_STATE.md](./PROJECT_STATE.md)
- **Rules**: [AGENTS.md](./AGENTS.md)
- **Decisions log**: [DECISIONS.md](./DECISIONS.md)
- **Verification**: `ai/scripts/verify.sh`
- **Context bundler**: `ai/ai-context.sh`
