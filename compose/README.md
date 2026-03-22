# Compose Runtime Guide

This folder is a self-contained local orchestration boundary for the AgentMarketing platform.

## What Runs Here

Compose starts the following services from [dockercompose.yml](dockercompose.yml):

- chromadb (vector store)
- postgres (relational database)
- redis (queue and cache)
- backend (FastAPI API + worker processes)
- frontend (Next.js dev server)

## Start and Stop

From repository root:

```bash
docker compose -f compose/dockercompose.yml up --build
```

Detached mode:

```bash
docker compose -f compose/dockercompose.yml up --build -d
```

Stop:

```bash
docker compose -f compose/dockercompose.yml down
```

Stop and remove volumes:

```bash
docker compose -f compose/dockercompose.yml down -v
```

## Service Ports

- frontend: http://localhost:3000
- backend: http://localhost:8001
- backend docs: http://localhost:8001/docs
- chromadb: http://localhost:8000
- postgres: localhost:5433
- redis: localhost:6379

## Environment Wiring

Backend service uses [backend/.env](backend/.env) through env_file.

Compose overrides key runtime variables in [dockercompose.yml](dockercompose.yml):

- DATABASE_URL=postgresql://agentsociety:dev_password@postgres:5432/agentsociety_db
- REDIS_URL=redis://redis:6379/0
- CHROMA_HOST=chromadb
- CHROMA_PORT=8000
- CHROMA_SSL=false
- PORT=7860

Frontend service environment in [dockercompose.yml](dockercompose.yml):

- BACKEND_PROXY_URL=http://backend:7860
- NEXT_TELEMETRY_DISABLED=1

## Health and Logs

Service status:

```bash
docker compose -f compose/dockercompose.yml ps
```

Tail all logs:

```bash
docker compose -f compose/dockercompose.yml logs -f
```

Tail specific services:

```bash
docker compose -f compose/dockercompose.yml logs -f backend
docker compose -f compose/dockercompose.yml logs -f frontend
docker compose -f compose/dockercompose.yml logs -f postgres redis chromadb
```

## Common Issues

### Backend not reachable from frontend

Check:

- backend container is healthy
- frontend has BACKEND_PROXY_URL=http://backend:7860
- rewrite exists in [../frontend/next.config.js](../frontend/next.config.js)

### Database or Redis connection errors

Check service readiness and compose health checks in [dockercompose.yml](dockercompose.yml).

### Empty env file values

If [backend/.env](backend/.env) is missing, copy from [backend/.env.local](backend/.env.local) and update with valid values.

```bash
cp compose/backend/.env.local compose/backend/.env
```

## Data Persistence

Named volumes defined in [dockercompose.yml](dockercompose.yml):

- chroma_data
- postgres_data
- redis_data

Backend uploads/reports are bind-mounted to:

- [backend/backend/uploads](backend/backend/uploads)
- [backend/backend/reports](backend/backend/reports)
