# Backend Guide

FastAPI backend for project management, simulation orchestration, result aggregation, and report generation.

## Core Stack

- FastAPI application entry: [backend/app/main.py](backend/app/main.py)
- Routers: [backend/app/routers](backend/app/routers)
- Celery tasks: [backend/app/tasks.py](backend/app/tasks.py)
- Simulation workers: [simulation](simulation)

## Runtime Modes

### Local script mode

Run all backend-side processes with [start_services.sh](start_services.sh):

- FastAPI API on port 8001
- Celery worker
- Ray simulation worker

### Hugging Face / container mode

Container startup script [start_hf_services.sh](start_hf_services.sh) launches:

- Uvicorn API server
- Celery worker
- simulation_worker.py

## API Routers

### Authentication

Defined in [backend/app/routers/auth.py](backend/app/routers/auth.py):

- POST /auth/register
- POST /auth/login
- GET /auth/me

### Projects

Defined in [backend/app/routers/projects.py](backend/app/routers/projects.py):

- POST /projects
- GET /projects
- GET /projects/{project_id}
- PATCH /projects/{project_id}/context
- DELETE /projects/{project_id}

Notes:

- Project video upload validates extension and size.
- Video files are uploaded to Hugging Face storage through hf_storage service.

### Simulations

Defined in [backend/app/routers/simulations.py](backend/app/routers/simulations.py):

- POST /simulations/{project_id}/start
- POST /simulations/{simulation_id}/cancel
- GET /simulations/{simulation_id}
- GET /simulations/{simulation_id}/status
- GET /simulations/{simulation_id}/results
- GET /simulations/project/{project_id}
- GET /simulations/{simulation_id}/map-data
- GET /simulations/{simulation_id}/agents/{agent_id}
- GET /simulations/{simulation_id}/report

### Custom Agents

Defined in [backend/app/routers/agents.py](backend/app/routers/agents.py):

- POST /agents
- GET /agents
- GET /agents/{agent_id}
- PUT /agents/{agent_id}
- DELETE /agents/{agent_id}

## Health Endpoints

Defined in [backend/app/main.py](backend/app/main.py):

- GET /
- GET /health

/health checks:

- database connectivity
- redis connectivity

## Worker Internals Overview

### Celery path

- API starts async job via Celery task dispatch.
- Worker consumes task queue and executes simulation pipeline.

### Simulation worker path

- [simulation/simulation_worker.py](simulation/simulation_worker.py) handles simulation processing and data production.
- Results listener in [backend/app/results_listener.py](backend/app/results_listener.py) receives and stores output.

### Status flow

- Running simulation status can be cached in Redis.
- Polling endpoints read and return progress metadata.

## Configuration

Primary settings live in [backend/app/config.py](backend/app/config.py).

Important variables:

- DATABASE_URL
- REDIS_URL
- CHROMA_HOST / CHROMA_PORT / CHROMA_SSL
- GEMINI_API_KEY / GEMINI_API_KEYS
- QWEN_API_URL / QWEN_MODEL_NAME
- HF_ACCESS_TOKEN and video repository settings
- JWT_SECRET / JWT_ALGORITHM / JWT_EXPIRY_HOURS

## Local Development

Install dependencies:

```bash
pip install -r requirements.txt
```

Run API only:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Run full local backend process set:

```bash
./start_services.sh
```

## Troubleshooting

### 401 loops or login issues

Check token handling and Authorization header flow from frontend.

### Simulation stuck in PENDING/RUNNING

Check:

- Redis availability
- Celery worker logs
- simulation worker process logs

### Storage upload failures

Check Hugging Face token and repository configuration in environment variables.
