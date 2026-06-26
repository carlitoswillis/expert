# Decisions Log

Why things are the way they are. Don't silently reverse these — if you change
one, update this file.

## 2026-06-26 — OCR fallback for scanned PDFs (re-added)

### Scanned/image PDFs now OCR'd with a pure-WASM pipeline
The v2.0 note below ("pdf-parse … does not OCR scanned PDFs; those land empty")
was a real gap: a chunk of the owner's school readings (Gleitman, Cattell, Hoff,
Pinker, …) are image scans with **zero** text layer — `pdf-parse` returns `''`,
so they were unsearchable. Re-added OCR, but **not** the old shell-out pipeline.
New stack, both pure WebAssembly (no poppler/ghostscript/system-tesseract, no
native build — safe on bleeding-edge Node 26):
- `mupdf` (WASM) rasterizes each page to PNG.
- `tesseract.js` (WASM) recognizes the text. Free, local, offline after the
  first language-model fetch. No API key.
Lives in `server/ocr.js`; lazy-imported so it costs nothing until a scan needs it.

### OCR runs in the background, with a record `status`
OCR is slow (~1–2s/page), so blocking the upload request was unacceptable.
Upload now extracts the text layer synchronously; if a PDF comes back under
`OCR_MIN_CHARS` (40) non-space chars it's saved as `status:"processing"` and
OCR is enqueued fire-and-forget, flipping the record to `ready` (or `failed`)
when done. Added a `status` field through config/schema/both stores. The client
dims `processing` cards (Edit disabled, not openable) and **quietly polls** every
3s so they light up when ready.

### Parallel via a shared tesseract worker pool
Owner wanted it fast on a 32GB M1. `server/ocr.js` keeps one shared pool of
`OCR_CONCURRENCY` (default `min(cores-1, 6)`) long-lived workers; pages from any
job are recognized in parallel through it — caps memory while keeping all cores
busy. Tunables: `OCR_CONCURRENCY`, `OCR_DPI` (200), `OCR_MIN_CHARS`.

## 2026-06-26 — LLM auto-fill of Title / Authors / Year

### Pull bibliographic metadata from the text when the user leaves it blank
Uploads rarely carry good metadata; the title was just the filename. A source's
own text (first page) usually states title/authors/year, so an LLM extracts them
in the same background pass as OCR. Only fields the user left blank are filled —
explicit input always wins. Lives in `server/metadata.js`; `server/jobs.js`
orchestrates OCR + metadata then flips `status` to `ready`.

### Provider cascade: Gemini → Gemma → local Ollama
Owner's call: prefer a "higher but free Google LLM", fall back to Gemma, then to
local. So the order is `gemini-2.5-flash` → `gemma-4-31b-it` (both Google's free
Generative Language API, one key `GOOGLE_AI_API_KEY`) → a local Ollama model
(`qwen2.5-coder:14b`, what's installed). First provider to return usable JSON
wins; all best-effort. With **no** provider configured the feature is inert and
upload behaves exactly as before (keeps the zero-config default intact).

### Year via Google Search grounding (not a separate search API)
The publication year is usually absent from the text (a scanned chapter doesn't
reprint its date), so extraction left it blank. Rather than bolt on a search API
or scrape Google, we reuse Gemini's built-in **Google Search grounding**: when
the year is missing but we have a title, one small grounded follow-up asks just
for the year (`tools:[{google_search:{}}]`, parsed with a 4-digit regex). Only
fires on the gap, so it doesn't spend grounding quota on every upload; Gemini-only
(Ollama can't search); toggle with `METADATA_YEAR_SEARCH`. Verified: Gleitman &
Newport scan → 1995.

### Why not local-only, given "fuck qwen"
Tested both on a scanned paper: local qwen-coder took ~24s and returned the wrong
(series) title; `gemini-2.5-flash` took ~4s and got the real title + both authors.
Google's free tier is the right default here; Ollama stays as the offline last
resort. (Note: this key exposes gemma-**4**, not gemma-3 — model is configurable
via `GEMMA_MODEL`.)

## 2026-06-26 — Product direction (v2.1 onward)

### Reframe: a knowledge tool for everyone, not a PDF search for academics
Owner: "this is a tool for each and every person seeking to gain and reconcile
knowledge, find and combine ideas." PDFs are still real (esp. academia) but are
just one input. The atomic unit is a **source of ideas**, not a PDF.

### Sequence: capture + organize FIRST, synthesis later
Chosen over "synthesis engine first" and "smarter search first." Get many source
types in and organized well; the AI synthesis ("find & combine ideas") is the
long-term differentiator but is deferred until the library is rich. Keeps
near-term work API-key-free and shippable.

### Inputs to support
PDF (done) · web articles · YouTube/podcasts · notes/text/ebooks · photos (OCR)
· voice notes · gated links (best-effort). Prioritized: paste-text and web
articles first (easiest, highest value, no external services).

### Aesthetic: warm reading app
Owner picked "warm reading app" (paper bg, serif headings, soft edges) over
modern-minimal and bold-editorial. The v2.0 crimson "old library" theme is to be
replaced — it read as dated and off-balance.

## 2026-06-26 — v2.0 rebuild

### Drop webpack, jQuery, axios, react-paginate → Vite + React 18 + fetch
The v1 build (webpack 4) doesn't play well with modern Node (v26 here), and the
frontend mixed jQuery AJAX, axios, and React 16 class components. Vite gives an
instant dev server + tiny config; native `fetch` and a small custom paginator
remove three dependencies. **Owner direction: "fuck webpack, build from scratch."**

### Pluggable storage; JSON file is the default
v1 hard-required a running MySQL just to boot. To make the app *run out of the
box*, the default store is a single JSON file (`data/sources.json`) with the
same substring-search semantics. MySQL is opt-in via `DB_HOST`. mysql2 (and the
JSON store) are pure JS, so there are no native-build problems on bleeding-edge
Node.

### Parameterized queries (security fix)
v1 interpolated `req.query` straight into SQL (`... LIKE '%${q}%'`) — open SQL
injection. The MySQL store now uses bound parameters everywhere.

### pdf-parse instead of pdf-extract for the basic path
`pdf-extract` shells out to poppler/ghostscript/tesseract and is effectively
unmaintained — a poor "runs out of the box" story. `pdf-parse` is pure JS and
handles text-based PDFs. Trade-off: it does **not** OCR scanned/image PDFs;
those land with empty `content`. The legacy OCR pipeline remains the answer for
that (see backlog).

### Legacy pipeline kept, not wired in
`/process` (Google Drive upload, PPTX→PDF, PDF "chopping"), `/ocr`, and
`node-ppt2pdf-master` are left in place for reference but are not imported by the
v2 server. They need external creds/binaries and weren't part of the "make it
run + look better" goal. Remove or modernize deliberately later.

### Records store extracted text + metadata, not the original file
v1 pushed originals to Google Drive and linked them. v2 (so far) keeps only
extracted text + metadata. Re-attaching/serving the original PDF is on the
backlog.

### Did not use qwen / aider for the edits
Owner tried `aider` + `qwen2.5-coder:14b/32b` locally first; it was too slow
("that took forever"). Owner direction: "fuck qwen too for now." Edits were made
directly. The Ollama models + `Modelfile` (`qwen2.5-coder-14b-32k`) are still
set up locally if you want to retry; see `HUMAN_GUIDE.md`.
