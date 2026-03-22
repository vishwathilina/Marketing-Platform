<table>
  <tr>
    <td valign="top">
      <img src="frontend/public/logo.png" alt="AgentMarketing Logo" width="200"/>
    </td>
    <td valign="top">
      <h1>AgentMarketing Platform</h1>
      <p>End-to-end platform for running AI-agent marketing simulations from uploaded ad videos.</p>
      <p>This repository supports two runtime models:</p>
      <ul>
        <li>Compose-based local stack for full development and integration testing</li>
        <li>Hugging Face-hosted services for cloud usage</li>
      </ul>
      <p>
        <a href="https://marketing-platform-two.vercel.app" target="_blank" rel="noopener noreferrer">
          <img src="https://img.shields.io/badge/Live%20Frontend-Open-0ea5e9?style=for-the-badge" alt="Live Frontend"/>
        </a>
      </p>
    </td>
  </tr>
</table>



## Technologies Used

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?style=flat-square&logo=celery&logoColor=white)
![Ray](https://img.shields.io/badge/Ray-028CF0?style=flat-square&logo=ray&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![ChromaDB](https://img.shields.io/badge/ChromaDB-5B3CC4?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-FFD21E?style=flat-square&logo=huggingface&logoColor=black)


## What This Platform Does

- Upload and manage ad campaign video projects
- Generate AI-agent reactions and behavior events
- Run simulations with Celery + Ray worker flow
- Store and retrieve vector/context data with ChromaDB
- Analyze outcomes with sentiment, behavior, and risk visualizations
- View project and simulation results in a Next.js dashboard




## Runtime Models

### 1) Compose Local Runtime

Use the Compose stack when you want a complete local environment with all dependencies.

Defined in:

- compose/dockercompose.yml

Local Compose services:

- PostgreSQL (database)
- Redis (queue + pub/sub)
- ChromaDB (vector storage)
- Backend API (FastAPI + Celery + simulation worker)
- Frontend app (Next.js)

Default local endpoints:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- Backend docs: http://localhost:8001/docs
- ChromaDB: http://localhost:8000
- PostgreSQL: localhost:5433
- Redis: localhost:6379

### 2) Hugging Face Hosted Runtime

Primary cloud deployment uses Hugging Face spaces and datasets.

Hosted paths and references:

- Frontend points to hosted backend through environment values
- Backend can run from root backend Docker image
- Qwen generation endpoint is configured as a Hugging Face Space URL
- Video storage is configured to a Hugging Face Dataset repository

Current frontend runtime env points to:

- NEXT_PUBLIC_API_URL=https://vish85521-backend.hf.space
- BACKEND_PROXY_URL=https://vish85521-backend.hf.space

## Repository Structure

### Root folders

- backend: source of the backend application and simulation workers
- frontend: source of the Next.js frontend
- compose: compose-ready snapshot for full local orchestration
- chromadb: Docker support for standalone ChromaDB deployment
- database: SQL schema

### Why compose contains backend and frontend copies

The compose folder is a self-contained local stack boundary. It includes backend and frontend app trees so docker compose can build and run the stack without depending on external paths.

In short:

- Use compose when running everything locally together
- Use root backend and root frontend for hosted/deployment workflows

### Gemini api key
- replace key with this 
- GEMINI_API_KEY=<PLACEHOLDER>
## Quick Start (Compose)

Prerequisites:

- Docker
- Docker Compose v2

From repository root:

```bash
docker compose -f compose/dockercompose.yml up --build
```

Run detached:

```bash
docker compose -f compose/dockercompose.yml up --build -d
```

Stop services:

```bash
docker compose -f compose/dockercompose.yml down
```

Stop and remove volumes:

```bash
docker compose -f compose/dockercompose.yml down -v
```

## Environment Configuration

### Compose backend env file

Compose backend reads:

- compose/backend/.env

If compose/backend/.env does not exist yet but compose/backend/.env.local exists, create it with:

```bash
cp compose/backend/.env.local compose/backend/.env
```

Container overrides in compose/dockercompose.yml set:

- DATABASE_URL=postgresql://agentsociety:dev_password@postgres:5432/agentsociety_db
- REDIS_URL=redis://redis:6379/0
- CHROMA_HOST=chromadb
- CHROMA_PORT=8000
- CHROMA_SSL=false
- PORT=7860

### Frontend env files

- frontend/.env.local: local frontend runtime values
- compose/frontend/.env.local: compose-contained frontend values

### Security note

Do not commit real secrets (API keys, tokens, private credentials). Use placeholders and inject real values through secure environment configuration.

## Backend Service Process Model

Backend runtime includes:

- FastAPI API server (Uvicorn)
- Celery worker
- Simulation worker process

Startup script:

- backend/start_hf_services.sh

That script starts all required backend-side processes and exits fast if any critical process terminates unexpectedly.

## Hugging Face Deployment Notes

### Backend deployment source

- backend/Dockerfile

### Frontend deployment behavior

- Frontend rewrites/proxy behavior is configured to use BACKEND_PROXY_URL
- This avoids hardcoded localhost routing in hosted mode

### Common hosted failure modes

- Dependency version conflicts in pinned requirements
- Proxy misconfiguration pointing to localhost instead of hosted backend URL
- Missing external Redis/PostgreSQL endpoints for worker components

## Developer Workflow

### Recommended local development path

1. Start compose stack
2. Open frontend at localhost:3000
3. Validate backend health at localhost:8001/health
4. Run project upload and simulation flow
5. Confirm worker outputs and charts

### Useful commands

```bash
docker compose -f compose/dockercompose.yml ps
docker compose -f compose/dockercompose.yml logs -f backend
docker compose -f compose/dockercompose.yml logs -f frontend
docker compose -f compose/dockercompose.yml logs -f redis postgres chromadb
```

## Troubleshooting

### Frontend login/API calls fail with connection refused

Check:

- frontend/next.config.js rewrite destination uses BACKEND_PROXY_URL
- BACKEND_PROXY_URL value points to reachable backend host
- Backend container/service is healthy

### Pip dependency resolver fails during backend build

Check for pinned version conflicts in:

- backend/requirements.txt

Resolve by aligning dependent package ranges rather than forcing incompatible major versions.

### Workers do not process jobs

Check:

- Redis connectivity
- Celery worker logs
- simulation worker logs
- backend /health response for dependency status


