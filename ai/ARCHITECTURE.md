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
  - `GET  /sources` — list/search (`q`, `page`, `limit`, or field filters).
  - `GET  /sources/:id` — full record (includes extracted `content`).
  - `POST /sources` — multipart upload (`myFile[]` + metadata); extracts text.
  - `PUT  /sources/:id` — update metadata.
  - `DELETE /sources/:id` — delete.
- `server/extract.js` — pure-JS PDF text extraction via `pdf-parse`
  (best-effort; never throws).

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

### Legacy (not wired into v2) — `process/`, `ocr/`, `node-ppt2pdf-master/`
The original heavy pipeline: Google Drive upload, PowerPoint→PDF conversion,
PDF quartile "chopping", and Tesseract OCR for scanned PDFs (via the old
`pdf-extract`). Kept for reference and as the path for OCR of image-only PDFs.
See [DECISIONS.md](./DECISIONS.md).

## Data Flow

### Upload
```
PDF(s) ──multipart──▶ POST /sources ──▶ multer saves to uploads/
        ──▶ extract.js (pdf-parse → normalized text)
        ──▶ store.create({ title, authors, …, content })
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
