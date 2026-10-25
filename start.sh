#!/usr/bin/env bash
# Why-Code — start the demo backend and the frontend together.
#
#   ./start.sh
#
# Backend:  FastAPI demo app (offline fixture data, no Neo4j or API keys)
#           http://localhost:8000   (health check: /health)
# Frontend: Next.js at http://localhost:3000, wired to that backend.
#
# Ctrl+C stops both. The first run creates the Python venv and installs
# dependencies, so it takes a few minutes; later runs start in seconds.
# To run the production backend instead, swap create_demo_app for
# create_app below and provide the real environment (see backend/.env.example).
set -euo pipefail
cd "$(dirname "$0")"

API_PORT=8000
WEB_PORT=3000 # must stay 3000: the backend CORS allows this origin only

for cmd in node npm python3; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing: $cmd — install it first (Node 20+, Python 3.12+)."; exit 1; }
done

# --- backend ---------------------------------------------------------------
if [ ! -x "backend/.venv/bin/python" ]; then
  echo "Setting up backend venv (first run)…"
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -e ./backend
fi

echo "Starting backend on :$API_PORT …"
(cd backend && PYTHONPATH=. .venv/bin/python -m uvicorn app.main:create_demo_app --factory --port "$API_PORT") &
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
  echo "Installing frontend dependencies (first run)…"
  (cd frontend && npm install)
fi
if [ ! -f "frontend/.env.local" ]; then
  printf 'NEXT_PUBLIC_API_MODE=http\nNEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:%s\n' "$API_PORT" > frontend/.env.local
  echo "Wrote frontend/.env.local (points the UI at the local backend)."
fi

echo "Starting frontend — open http://localhost:$WEB_PORT"
cd frontend && npm run dev
