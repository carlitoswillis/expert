# Project State

_Last updated: 2026-07-24_

## Product Direction (decided 2026-06-26)
Owner reframed the product: it's for **everyone seeking to gain and reconcile
knowledge, find and combine ideas** — not just academics, not just PDFs.
- **Core identity right now: _capture + organize first._** Get any kind of
  source in, well-organized. Layer synthesis ("find & combine ideas") on later
  once the library is rich.
- **Inputs to support:** PDFs (done) · web pages/articles · YouTube/podcasts ·
  notes/text/ebooks · photos (OCR) · voice notes (transcription) · gated/paywalled
  links (best-effort).
- **Look & feel:** warm reading app — paper background, serif headings, soft
  edges. Hero copy idea: "What do you want to understand?"
- See [DECISIONS.md](./DECISIONS.md).

## Current Focus
- v2.1 shipped file/link/paste capture. Next: the remaining capture formats
  (transcripts, ebooks, photos, voice). **Work one task at a time.**

## Active Tasks (ordered — do the top one)
1. [ ] **Capture: YouTube/podcast transcripts** (link → transcript).
2. [ ] **Capture: ebooks (epub)** → text.
3. [ ] **Capture: photos (OCR)** via tesseract.js (offline, no API key). Now
       mostly reuse: `server/ocr.js` already has a shared tesseract.js worker
       pool — feed it an image instead of mupdf-rendered PDF pages.
4. [ ] **Capture: voice notes** (transcription — needs a model/API; scope later).

## Backlog
- [ ] Rename the product — "expert search" no longer fits the broadened "capture
      anything, find & combine ideas" direction. Pick a new name + update README,
      package metadata, and UI.
- [ ] Synthesis layer (the long-term vision): semantic search (embeddings) +
      cited, combined answers across sources. Defer until capture is solid.
- [ ] Search relevance: snippet/highlight of the matching passage in results.
- [ ] Remove the legacy `/process` + `/ocr` pipeline — superseded by the new
      pure-WASM OCR in `server/ocr.js` (mupdf + tesseract.js).
- [x] OCR path for scanned/image-only PDFs so `content` isn't empty —
      background, parallel, `status:"processing"` → `ready`. (2026-06-26)
- [x] Auto-fill Title/Authors/Year from text via LLM cascade (Gemini → Gemma →
      Ollama), background, only fills blank fields. `server/metadata.js`. (2026-06-26)
- [ ] Automated tests (API + a couple of component tests).
- [ ] AuthN if ever exposed beyond localhost (currently fully open).
- [ ] Optional: switch JSON store to SQLite+FTS5 for larger libraries.
- [ ] Manual smoke test in a browser (search, edit, delete, upload a real PDF).

## Completed (in-app PDF reader — 2026-07-24)
Search results for uploaded PDFs weren't clickable — records had no URL and the
server never served the stored files. Now every PDF on disk opens in-app:
- [x] **`GET /sources/:id/file`** streams the stored upload (`server/files.js`
      resolves records → disk, incl. legacy bulk-imported names with course
      prefixes; newest timestamp wins on re-uploads). New uploads persist the
      exact disk name in `fileID`.
- [x] **`hasFile` on list rows** — card titles link to `/read/:id` when the PDF
      exists on disk (even mid-OCR), else fall back to the external URL.
- [x] **Reader view (`/read/:id`)** — pdf.js (lazy-loaded chunk), pages fit to
      the column, lazy page rendering, and **rotation** (⟲/⟳, 90° steps) for
      old sideways scans — remembered per document in localStorage.

## Completed (bulk import — 2026-07-23)
Ingested `example texts/` (147 PDFs + 1 saved page) — 7.6M chars searchable.
Everything below was found *by* doing that import, on real data:
- [x] **Saved HTML files are documents too** — uploading a `.html` now runs the
      same readability pass a captured link gets (`capture.fromHtml`), and
      recovers the original address from the page's canonical link. Previously
      a saved page stored an empty record.
- [x] **Background job queue** (`JOBS_CONCURRENCY`, default 3). 147 uploads
      used to enqueue 147 unthrottled jobs and fire that many LLM calls at once.
- [x] **`METADATA_ENABLED=0`** — the Gemini free tier is **20 requests/day**
      (not per minute), so enrichment can't touch a bulk import. This skips it
      instead of stalling every record in `'processing'`.
- [x] **OCR threshold raised 40 → 250 chars.** Two scans carried only a citation
      stamp / rights notice as their text layer, cleared the old threshold, and
      were silently left unsearchable.
- [x] **Diacritic-insensitive search.** "Pirahã" matched 2 records while
      "Piraha" matched 6 — either spelling missed most of the library. The JSON
      store now folds accents like MySQL's collation already did.

## Completed (v2.1 — 2026-07-23)
- [x] **Warm reading redesign** of the client (paper bg, serif, soft edges).
- [x] **Generalized data model**: uploads now write `type`; `type`/`sourceUrl`
      are returned by both stores (the MySQL driver wasn't selecting them);
      cards show a source-type badge and the origin host.
- [x] **Capture: paste text / notes** — `POST /sources/text` → `type:"note"`.
      Notes deliberately skip LLM enrichment: the user wrote the text, so a
      guessed "author" is worse than a blank (an early test had Gemini
      attributing a personal note to Simone Weil).
- [x] **Capture: web articles** — `POST /sources/url` via
      `@extractus/article-extractor`, with a raw-HTML fallback so JS-heavy or
      gated pages still land in the library. `server/capture.js`.
- [x] **Add-source UI** with tabs: File · Link · Paste.
- [x] **Filter by source type** — `?type=` in both stores + chips in the UI.
      Legacy records with no `type` are bucketed by inference (JSON store).
- [x] **`-p / --port` CLI flag** — `npm start -- -p 3004` now works instead of
      being silently swallowed by node. Vite's dev proxy follows `API_PORT`.
- [x] **Stranded-job recovery** — sources left `'processing'` by a killed
      process were dimmed and un-editable forever; they're now settled at boot.
- [x] `verify.sh` covers the capture endpoints and runs against a temp
      `DATA_DIR` so smoke tests no longer write into the real library.

## Completed (v2.0 — 2026-06-26)
- [x] Replaced webpack 4 / jQuery / React 16 with Vite + React 18 client.
- [x] Rewrote the Express API; removed deprecated `body-parser`.
- [x] Fixed SQL injection — all queries parameterized (`mysql2`).
- [x] Pluggable storage: zero-config JSON store (default) + MySQL store.
- [x] Pure-JS PDF text extraction (`pdf-parse`), no Tesseract/poppler needed.
- [x] `/health` endpoint, env-driven config, `.env.example`, docker-compose.
- [x] Rewrote README; filled in the `/ai` homebase docs.
- [x] Seed script for demo data (`npm run seed`).
