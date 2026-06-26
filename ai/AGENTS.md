# Agent Guidelines (AGENTS.md)

PURPOSE: The authoritative rulebook for AI assistants working in this repo.
Read this before editing.

## Project Context
- **Objective**: A personal, full-text research search. Upload PDFs → extract
  text → search titles/authors/full text. Built to *narrow* results, not flood.
- **Stack**: Node.js (Express 4, CommonJS) API · Vite + React 18 (ESM) client ·
  pluggable storage (JSON file by default, MySQL via `mysql2` when `DB_HOST` set).
- **Entry points**: `server/index.js` (API), `client/src/main.jsx` (UI).

## Architecture Constraints
- **API shape**: REST under `/sources` (+ `/health`). Keep responses as
  `{ results, count }` for lists so the client pagination keeps working.
- **Storage is pluggable**: any new persistence must implement the full store
  interface (`list / get / create / update / remove`) and be selected in
  `server/store/index.js`. Don't let routes talk to a DB directly.
- **Security**: ALL database access must be parameterized. Never interpolate
  request input into SQL. (The v1 code did; v2 fixed it — don't regress.)
- **Two module systems**: server is CommonJS (`require`), client is ESM
  (`import`). Don't mix within a side.
- **Markdown persistence**: durable project state lives in `/ai`.

## Coding Conventions
- **Explicit over implicit**: no hidden globals, no reflection magic.
- **Best-effort extraction**: `extract.js` must never throw — a bad PDF should
  still produce a record (with empty `content`).
- **Match the surrounding style**: small functional React components + hooks on
  the client; small focused modules on the server.
- **Verification first**: run `ai/scripts/verify.sh` before declaring done.
- **Don't resurrect the legacy pipeline** (`/process`, `/ocr`,
  `node-ppt2pdf-master`) unless the task is explicitly about OCR / Drive / PPTX.

## How to Navigate This Workspace (Priority Flow)
1. **START HERE**: `PROJECT_STATE.md` — current focus, active tasks, backlog.
2. **Architecture**: `ARCHITECTURE.md` — components and data flow.
3. **This file**: operational rules. Adhere strictly.
4. **Decisions**: `DECISIONS.md` — *why* things are the way they are. Don't
   "fix" a documented decision without reason.
5. **Refresh context**: run `./ai/ai-context.sh` to regenerate
   `ai/CONTEXT_BUNDLE.md` (a compact snapshot for small local models).
