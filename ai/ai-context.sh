#!/bin/bash
# ai-context.sh - Bundle project context into ai/CONTEXT_BUNDLE.md for a small
# local model (e.g. qwen via aider). Run from anywhere:  bash ai/ai-context.sh

set -e
AI_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$AI_DIR/.." && pwd)"
CONTEXT_FILE="$AI_DIR/CONTEXT_BUNDLE.md"
cd "$ROOT"

echo "Generating AI context bundle..."

{
    echo "# AI Context Bundle"
    echo "Generated: $(date)"
    echo ""
    echo "## ⚠️ Agent Navigation Guide"
    echo "1. Read **Project State** for the current focus and tasks."
    echo "2. Read **Authoritative Rules (AGENTS.md)** and follow them."
    echo "3. Only open files directly related to your task. No full-repo scans"
    echo "   unless the task is an architectural audit."
    echo ""

    for doc in PROJECT_STATE AGENTS ARCHITECTURE DECISIONS; do
        echo "## $doc.md"
        if [ -f "ai/$doc.md" ]; then cat "ai/$doc.md"; else echo "_missing_"; fi
        echo ""
    done

    echo "## Repository Structure (depth 2, no deps/build)"
    echo '```text'
    find . -maxdepth 2 \
        -not -path '*/node_modules*' -not -path '*/.git*' \
        -not -path '*/dist*' -not -path '*/.aider*' -not -path '*/data*' | sort
    echo '```'
    echo ""

    echo "## Recent Git Changes"
    echo '```text'
    git log -n 8 --oneline 2>/dev/null || echo "No git history yet."
    echo '```'
    echo ""

    echo "## Active Diff (truncated)"
    echo '```diff'
    { git diff --cached; git diff; } | head -n 200
    echo '```'
} > "$CONTEXT_FILE"

echo "✅ Context bundle created at $CONTEXT_FILE"
echo "Words: $(wc -w < "$CONTEXT_FILE")"
