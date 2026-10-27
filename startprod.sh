#!/usr/bin/env bash
# Why-Code — start the production backend and the frontend together.
#
#   ./startprod.sh
#
# Backend:  FastAPI production app (requires Neo4j and LLM API keys)
#           http://localhost:8000   (health check: /health)
# Frontend: Next.js at http://localhost:3000, wired to that backend.
#
# This mode requires proper configuration in backend/.env:
#   - WHYCODE_NEO4J_URI, WHYCODE_NEO4J_USER, WHYCODE_NEO4J_PASSWORD
#   - WHYCODE_LLM_API_KEY, WHYCODE_LLM_MODEL (optional)
#
# Ctrl+C stops both. The first run creates the Python venv and installs
# dependencies, so it takes a few minutes; later runs start in seconds.
set -euo pipefail
cd "$(dirname "$0")"

API_PORT=8000
WEB_PORT=3000

# Load backend/.env if present
if [ -f "backend/.env" ]; then
    set -a
    source "backend/.env"
    set +a
fi

# Check for required Neo4j environment variables
if [ -z "${WHYCODE_NEO4J_URI:-}" ] || [ -z "${WHYCODE_NEO4J_USER:-}" ] || [ -z "${WHYCODE_NEO4J_PASSWORD:-}" ]; then
    echo "ERROR: Neo4j credentials not configured."
    echo "Please set WHYCODE_NEO4J_URI, WHYCODE_NEO4J_USER, and WHYCODE_NEO4J_PASSWORD in backend/.env"
    echo ""
    echo "Example:"
    echo "  WHYCODE_NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io"
    echo "  WHYCODE_NEO4J_USER=neo4j"
    echo "  WHYCODE_NEO4J_PASSWORD=your_password"
    exit 1
fi

for cmd in node npm python3; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "Missing: $cmd — install it first (Node 20+, Python 3.12+)."; exit 1; }
done

echo "Starting production backend on :$API_PORT ..."
echo "  Neo4j: $WHYCODE_NEO4J_URI"
echo "  LLM Model: ${WHYCODE_LLM_MODEL:-gpt-4o-mini}"

if [ ! -x "backend/.venv/bin/python" ]; then
    echo "Setting up backend venv (first run)..."
    python3 -m venv backend/.venv
    backend/.venv/bin/pip install -q -e ./backend
fi

(cd backend && PYTHONPATH=. .venv/bin/python -m uvicorn app.main:create_app --factory --port "$API_PORT" --reload) &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM

healthy=""
for _ in $(seq 1 30); do
    if curl -sf --noproxy '*' "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then healthy=1; break; fi
    sleep 1
done
[ -n "$healthy" ] || { echo "Backend did not come up — see the output above."; exit 1; }
echo "Backend is healthy."

# --- frontend --------------------------------------------------------------
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies (first run)..."
    (cd frontend && npm install)
fi
printf 'NEXT_PUBLIC_API_MODE=http\nNEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:%s\n' "$API_PORT" > frontend/.env.local
echo "Configured frontend/.env.local (API_MODE=http, BASE_URL=http://127.0.0.1:$API_PORT)."

echo "Starting frontend — open http://localhost:$WEB_PORT"
cd frontend && npm run dev
