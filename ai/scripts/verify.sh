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
# Point the store at a throwaway dir so smoke tests that create sources never
# touch the real library.
SANDBOX="$(mktemp -d)"
PORT="$PORT" DATA_DIR="$SANDBOX/data" UPLOAD_DIR="$SANDBOX/uploads" \
  node server/index.js >/tmp/expert-verify.log 2>&1 &
SERVER_PID=$!
trap '{ kill $SERVER_PID && wait $SERVER_PID; } 2>/dev/null; rm -rf "$SANDBOX"' EXIT

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

# --- Capture paths (no network needed for text) ---
curl -fsS -X POST "http://localhost:$PORT/sources/text" \
  -H 'Content-Type: application/json' \
  -d '{"title":"verify note","text":"a smoke-test note about widgets"}' \
  | grep -q '"type":"note"' \
  && pass "POST /sources/text" || fail "POST /sources/text"

curl -fsS "http://localhost:$PORT/sources?type=note" | grep -q 'verify note' \
  && pass "type filter" || fail "type filter"

curl -fsS "http://localhost:$PORT/sources?q=widgets" | grep -q 'verify note' \
  && pass "full-text search" || fail "full-text search"

# Accents must not hide a source: searching either spelling finds it.
curl -fsS -X POST "http://localhost:$PORT/sources/text" \
  -H 'Content-Type: application/json' \
  -d '{"title":"accent note","text":"the Pirahã language"}' >/dev/null
curl -fsS "http://localhost:$PORT/sources?q=Piraha" | grep -q 'accent note' \
  && pass "diacritic-insensitive search" || fail "unaccented query missed an accented source"

# A bad link must be a clean 400, not a 500.
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$PORT/sources/url" \
  -H 'Content-Type: application/json' -d '{"url":"not-a-url"}')" = "400" ] \
  && pass "rejects a bad link" || fail "bad link should 400"

echo "✅ verify passed"
