#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"

PIDS=()
NAMES=()
CLEANED_UP=0

cleanup() {
    if [[ "$CLEANED_UP" -eq 1 ]]; then
        return
    fi
    CLEANED_UP=1

    echo
    echo "Stopping services..."
    for i in "${!PIDS[@]}"; do
        pid="${PIDS[$i]}"
        name="${NAMES[$i]}"
        if kill -0 "$pid" 2>/dev/null; then
            echo "- Stopping $name (PID: $pid)"
            kill "$pid" 2>/dev/null || true
        fi
    done

    for pid in "${PIDS[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    echo "All services stopped."
}

trap cleanup EXIT
trap 'exit 130' INT TERM

echo "============================================================"
echo "       AgentSociety Platform - Starting Services"
echo "============================================================"
echo

if [[ -f "$ROOT_DIR/.venv/bin/activate" ]]; then
    VENV_DIR=".venv"
elif [[ -f "$ROOT_DIR/venv/bin/activate" ]]; then
    VENV_DIR="venv"
else
    echo "ERROR: Virtual environment not found (.venv or venv)."
    echo "Create one with: python3 -m venv .venv"
    echo "Then install dependencies: .venv/bin/pip install -r requirements.txt"
    exit 1
fi

mkdir -p "$LOG_DIR"

start_service() {
    local name="$1"
    local command="$2"
    local log_file="$3"

    bash -lc "$command" >"$log_file" 2>&1 &
    local pid=$!
    PIDS+=("$pid")
    NAMES+=("$name")
    echo "- Started $name (PID: $pid)"
}

echo
echo "Starting services..."

start_service \
    "FastAPI Backend" \
    "cd '$ROOT_DIR/backend' && source '$ROOT_DIR/$VENV_DIR/bin/activate' && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001" \
    "$LOG_DIR/backend.log"

start_service \
    "Celery Worker" \
    "cd '$ROOT_DIR/backend' && source '$ROOT_DIR/$VENV_DIR/bin/activate' && celery -A app.tasks worker --loglevel=info --pool=solo" \
    "$LOG_DIR/celery.log"

start_service \
    "Ray Simulation Worker" \
    "cd '$ROOT_DIR' && source '$ROOT_DIR/$VENV_DIR/bin/activate' && python simulation/simulation_worker.py" \
    "$LOG_DIR/ray_worker.log"

echo
echo "============================================================"
echo "              All Services Started"
echo "============================================================"
echo "Backend API: http://localhost:8001"
echo "API Docs:    http://localhost:8001/docs"
echo
echo "Log files:"
echo "- $LOG_DIR/backend.log"
echo "- $LOG_DIR/celery.log"
echo "- $LOG_DIR/ray_worker.log"
echo
echo "Press Ctrl+C to stop all services."

# Keep the supervisor alive until interrupted so one failed service
# does not automatically stop all other running services.
while true; do
    sleep 1
done
