#!/bin/bash
# verify.sh — the "did I break it?" button.
# Builds the client, boots the server, and smoke-tests the API.
# Run from the repo root:  npm run verify   (or  bash ai/scripts/verify.sh)

set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PORT="${PORT:-3100}"   # use an off-port so we don't clash with a running dev server

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; exit 1; }

echo "▶ Installing deps"
npm install --silent >/dev/null 2>&1 && pass "backend deps" || fail "backend install"

echo "▶ Building client"
npm run build --silent >/dev/null 2>&1 && pass "client build" || fail "client build"

echo "▶ Booting server on :$PORT"
PORT="$PORT" node server/index.js >/tmp/expert-verify.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

# wait for /health
for i in $(seq 1 20); do
  if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

echo "▶ Smoke tests"
curl -fsS "http://localhost:$PORT/health" | grep -q '"status":"ok"' \
  && pass "/health" || fail "/health did not respond ok"
curl -fsS "http://localhost:$PORT/sources?limit=1" | grep -q '"results"' \
  && pass "/sources list" || fail "/sources list"

echo "✅ verify passed"
