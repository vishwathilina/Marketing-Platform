@echo off
REM ============================================================
REM AgentSociety Platform - Service Startup Script
REM ============================================================
REM This script starts all required services for the platform:
REM   1. FastAPI Backend (API server)
REM   2. Celery Worker (VLM video processing)
REM   3. Ray Simulation Worker (Agent simulation)
REM ============================================================

echo ============================================================
echo        AgentSociety Platform - Starting Services
echo ============================================================
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv venv
    echo Then install dependencies: pip install -r requirements.txt
    pause
    exit /b 1
)

echo Starting services...
echo.

REM Terminal 1: FastAPI Backend
echo [1/3] Starting FastAPI Backend on http://localhost:8001
start "Backend - FastAPI" cmd /k "cd /d %~dp0 && venv\Scripts\activate && cd backend && uvicorn app.main:app --reload --port 8001"
timeout /t 2 /nobreak > nul

REM Terminal 2: Celery Worker (VLM Processing)
echo [2/3] Starting Celery Worker (VLM Processing)
start "Celery - VLM Worker" cmd /k "cd /d %~dp0 && venv\Scripts\activate && cd backend && celery -A app.tasks worker --loglevel=info --pool=solo"
timeout /t 2 /nobreak > nul

REM Terminal 3: Ray Simulation Worker
echo [3/3] Starting Ray Simulation Worker (Agent Simulation)
start "Ray - Simulation Worker" cmd /k "cd /d %~dp0 && venv\Scripts\activate && python simulation\simulation_worker.py"
timeout /t 2 /nobreak > nul

echo.
echo ============================================================
echo              All Services Started Successfully!
echo ============================================================
echo.
echo Service URLs:
echo   - Backend API:   http://localhost:8001
echo   - API Docs:      http://localhost:8001/docs
echo.
echo Architecture:
echo   - Celery Worker: Handles video processing (VLM)
echo   - Ray Worker:    Handles agent simulations
echo.
echo To stop all services, close all opened terminal windows
echo or press Ctrl+C in each terminal.
echo ============================================================
echo.
pause
