> **Retired.** This project is folded into the private `AIA2ndBrain` repo: OCR and capture now live in the vault watcher, and the vault is the only memory store. This repo stays as reference code only.

# expert search

A focused knowledge tool: capture sources you read, extract their full text, and
search across everything you've collected. Built to **narrow** — to complement a
researcher's mind, not flood it.

> **v2.0 (2026):** rebuilt from the old webpack/jQuery/React-16 + required-MySQL
> stack to a modern **Vite + React 18** client and an **Express** API with a
> pluggable store that runs with **zero setup**. The product is evolving from
> "search my PDFs" toward "capture anything, then find & combine ideas across it."
> See [`ai/`](./ai) for architecture, decisions, and the roadmap.

## Quick start

```bash
npm run setup    # installs server + client deps and builds the client
npm run seed     # (optional) add a few demo sources
npm start        # → http://localhost:3000
```

That's it — no database required. Sources are kept in a local JSON file
(`data/sources.json`).

**On another port** (when :3000 is busy) — either works:

```bash
npm start -- -p 3004     # or --port 3004
PORT=3004 npm start
```

### Develop with hot reload

```bash
npm run dev                        # API on :3000 with --watch
npm run client:dev                 # Vite dev server on :5173 (proxies the API)
API_PORT=3004 npm run client:dev   # …when the API is on a non-default port
```

Open http://localhost:5173 while developing.

## How it works

- **Capture** — three ways in: **File** (PDFs, with OCR for scans), **Link** (a
  web article — fetched and reduced to its readable text), and **Paste** (a note,
  quote, or passage). More coming: YouTube/podcast transcripts, ebooks, photos,
  voice.
- **Search** — substring search over titles, authors, and full text, paginated,
  narrowable by source type.
- **Organize** — edit metadata or delete from the results.

Optionally, an LLM fills in blank Title/Authors/Year in the background — see
`GOOGLE_AI_API_KEY` in `.env.example`. With no key set, nothing runs.

API: `GET /health`, `GET /sources` (`q`, `type`, `page`, `limit`),
`GET /sources/:id`, `POST /sources` (multipart upload),
`POST /sources/url` (`{url}`), `POST /sources/text` (`{title, text, authors, url}`),
`PUT /sources/:id`, `DELETE /sources/:id`.

## Optional: MySQL instead of the JSON store

Set `DB_HOST` (see `.env.example`) to switch to the MySQL driver. A local DB is
provided via Docker:

```bash
docker compose up -d                       # MySQL 8, schema auto-loaded
cp .env.example .env                        # then set DB_HOST=localhost etc.
npm start
```

## Built with

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [Express](https://expressjs.com/) (Node.js)
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) for text extraction
- JSON file store by default · [MySQL](https://www.mysql.com/) via
  [mysql2](https://www.npmjs.com/package/mysql2) optional

## Verify

```bash
npm run verify   # builds the client, boots the server, smoke-tests the API
```

## Roadmap

Tracked in [`ai/PROJECT_STATE.md`](./ai/PROJECT_STATE.md). Next up: the rest of
multi-format capture — YouTube/podcast transcripts, ebooks, photos, voice — then
the synthesis layer (semantic search and cited, combined answers).
