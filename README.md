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

### Develop with hot reload

```bash
npm run dev          # API on :3000 with --watch
npm run client:dev   # Vite dev server on :5173 (proxies the API)
```

Open http://localhost:5173 while developing.

## How it works

- **Capture** — upload PDFs (more source types coming: web links, YouTube/
  podcasts, notes, ebooks). Text is extracted automatically so it's searchable.
- **Search** — substring search over titles, authors, and full text, paginated.
- **Organize** — edit metadata or delete from the results.

API: `GET /health`, `GET /sources`, `GET /sources/:id`, `POST /sources`
(multipart upload), `PUT /sources/:id`, `DELETE /sources/:id`.

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

Tracked in [`ai/PROJECT_STATE.md`](./ai/PROJECT_STATE.md). Next up: multi-format
capture (web articles, YouTube/podcast transcripts, notes/ebooks, photos, voice)
and a warm reading-app redesign.
