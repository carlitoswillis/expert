# Decisions Log

Why things are the way they are. Don't silently reverse these — if you change
one, update this file.

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
