# Human Guide: Steering Your AI Workspace

This `/ai` folder is a "map" for any AI assistant working on **expert search**,
so it stays focused and follows your standards. It is filled in for this project
(it started life as a blank template).

## 1. Philosophy: You are the Pilot
- **You (Pilot)**: provide **Intent** (what & why) and **Verification** (is it right?).
- **AI (Co-Pilot)**: provides **Implementation**.

## 2. The files (the tour)
- **`PROJECT_STATE.md`** — steering wheel: current focus, active tasks, backlog.
- **`ARCHITECTURE.md`** — how the system is built and how data flows.
- **`AGENTS.md`** — the rulebook the AI must follow. Add a rule here when the AI
  keeps making the same mistake.
- **`DECISIONS.md`** — the "why". Log choices so they don't get silently undone.
- **`plans/`** — drop a written plan here before a big feature.
- **`ai-context.sh`** — packages the repo state into `CONTEXT_BUNDLE.md` for a
  small local model. Run: `bash ai/ai-context.sh`
- **`scripts/verify.sh`** — the "did I break it?" button. Run: `npm run verify`

## 3. The core loop
1. **Focus** — update *Current Focus* in `PROJECT_STATE.md`.
2. **Bundle** (only if using a local model) — `bash ai/ai-context.sh`.
3. **Work** — make the change (directly, or drive a local model — see below).
4. **Verify** — `npm run verify`. Don't commit code that fails it.

## 4. Using a local model (optional)
A local Ollama setup exists (`Modelfile` → `qwen2.5-coder-14b-32k`). It was slow
in practice for this repo, so v2 was built directly. If you want to retry:
```bash
ollama list                         # confirm the runtime is up
export OLLAMA_API_BASE=http://127.0.0.1:11434
aider --model ollama/qwen2.5-coder:14b
# inside aider:
> Read ai/CONTEXT_BUNDLE.md. Do the first task in ai/PROJECT_STATE.md.
> Follow ai/AGENTS.md strictly.
```

## 5. Safety & Git
1. **Feature branches** — e.g. `git checkout -b ai/<task>`.
2. **Review before merging** to `master`.
3. **Keep edits scoped** — a couple of files per request beats ten.
4. **Markdown is memory** — if it matters, write it down in `/ai`.
