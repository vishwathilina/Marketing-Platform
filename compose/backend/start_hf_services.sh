#!/usr/bin/env bash

set -euo pipefail

PORT="${PORT:-7860}"
PIDS=()

cleanup() {
  echo "[startup] Stopping all services..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  wait || true
}

trap cleanup EXIT INT TERM

echo "[startup] Launching AgentSociety services"
echo "[startup] Backend on :$PORT"

echo "[startup] Initializing database schema..."
cd /app/backend
python init_db.py

uvicorn app.main:app --host 0.0.0.0 --port "$PORT" &
PIDS+=("$!")

celery -A app.tasks worker --loglevel=info --pool=solo &
PIDS+=("$!")

cd /app
python simulation/simulation_worker.py &
PIDS+=("$!")

echo "[startup] Services started. PIDs: ${PIDS[*]}"

# Fail fast if any service exits unexpectedly.
wait -n "${PIDS[@]}"
echo "[startup] A service exited unexpectedly."
exit 1