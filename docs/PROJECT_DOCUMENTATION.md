# AgentSociety Platform - Complete Project Documentation

## 1. Document Purpose
This document provides a complete technical and operational description of the AgentSociety platform, including architecture, components, data flow, API behavior, setup, runtime operations, failure modes, and maintenance guidance.

Scope:
- Frontend, backend, simulation engine, and infrastructure services
- Local and cloud-backed development modes
- Developer and operator guidance

Out of scope:
- Product marketing copy
- Legal/compliance certification documents

---

## 2. System Overview
AgentSociety is an AI-driven marketing risk simulation platform. Users upload a video advertisement, the system analyzes the content, and then simulates reactions from synthetic social agents to estimate virality and identify possible demographic backlash.

Primary user journey:
1. User registers and logs in.
2. User creates a project and uploads a video.
3. Background video analysis produces contextual ad description.
4. User starts a simulation for that project.
5. Ray-based worker simulates agent reactions and sends results.
6. Backend persists outputs and frontend visualizes score, sentiment, map, and risk flags.

---

## 3. High-Level Architecture
Core runtime consists of four major processes:
1. Frontend (Next.js 14)
2. Backend API (FastAPI)
3. Celery worker (video processing + simulation queueing)
4. Simulation worker (Ray orchestration)

Shared services:
- PostgreSQL: relational persistence
- Redis: Celery broker/backend and pub/sub channels
- ChromaDB: optional agent memory store
- MQTT broker: agent messaging transport layer support
- External AI APIs: Gemini (video analysis), Qwen endpoint (agent reasoning)

Inter-process channels:
- Celery queue for asynchronous tasks
- Redis pub/sub channel simulation_requests for simulation dispatch
- Redis pub/sub channel simulation_results for simulation completion events

---

## 4. Repository Structure
Top-level modules:
- backend: FastAPI app, routers, models, tasks, listener
- frontend: Next.js app-router UI
- simulation: Ray-based simulation runtime and workers
- database/migrations: SQL schema bootstrap files
- docker-compose.yml: local infrastructure services
- start_services.bat: one-command startup for all major runtime processes

Operational scripts and utilities also exist at repository root for testing and log viewing.

---

## 5. Component Specifications

### 5.1 Frontend
Technology:
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- TanStack Query for client-side data fetching/caching

Responsibilities:
- Authentication workflows (register/login)
- Dashboard and project lifecycle UI
- Simulation start/status polling/results display
- Agent map visualization (Leaflet)

API client behavior:
- Uses Axios with base path /api (proxied by Next rewrites)
- Automatically attaches Bearer token when present
- Handles 401 by clearing token and redirecting to login

Notable behavior:
- Heavy pages compile slower in dev mode due to dynamic chart/map dependencies.

### 5.2 Backend API
Technology:
- FastAPI
- SQLAlchemy ORM
- Pydantic settings and schemas

Responsibilities:
- Authentication and authorization
- Project CRUD and file upload
- Simulation orchestration endpoints
- Health checks
- Startup/shutdown lifecycle hooks

Lifecycle behavior:
- Creates upload directory on startup
- Starts Redis-backed results listener thread on startup
- Stops listener on shutdown

### 5.3 Celery Worker
Responsibilities:
- process_video_task:
  - marks project PROCESSING
  - runs video analysis
  - writes context and duration
  - marks project READY (or FAILED on task exception)
- run_simulation_task:
  - validates simulation/project readiness
  - marks simulation RUNNING
  - publishes request to simulation_requests channel

Broker/backend:
- Redis URL from environment
- Supports TLS when using rediss URLs

### 5.4 Simulation Worker (Ray)
Responsibilities:
- Subscribes to simulation_requests
- Executes simulation pipeline through run_simulation
- Publishes success or failure payload to simulation_results

Resilience:
- Includes reconnect loop with exponential backoff
- Re-subscribes after Redis reconnection

### 5.5 Results Listener
Responsibilities:
- Subscribes to simulation_results
- Updates SimulationRun state and output fields
- Persists AgentLog and RiskFlag records

Current operational note:
- Listener is startup-thread based; if Redis connection drops and listener exits, result persistence can pause until restart unless reconnect logic is added similarly.

---

## 6. Data Model

### 6.1 User
Fields:
- id (UUID)
- email (unique)
- password_hash
- created_at
- subscription_tier

Relations:
- one-to-many projects

### 6.2 Project
Fields:
- id (UUID)
- user_id (FK)
- title
- video_path
- video_duration_seconds
- vlm_generated_context
- demographic_filter (JSON)
- status (PENDING, PROCESSING, READY, FAILED)
- created_at

Relations:
- one-to-many simulation_runs

### 6.3 SimulationRun
Fields:
- id (UUID)
- project_id (FK)
- status (PENDING, RUNNING, COMPLETED, FAILED)
- num_agents
- simulation_days
- virality_score
- sentiment_breakdown (JSON)
- map_data (JSON)
- agent_states (JSON)
- started_at, completed_at
- error_message
- created_at

Relations:
- one-to-many agent_logs
- one-to-many risk_flags

### 6.4 AgentLog
Fields:
- id (BigInteger)
- simulation_run_id (FK)
- agent_id
- timestamp
- event_type
- event_data (JSON)

### 6.5 RiskFlag
Fields:
- id (UUID)
- simulation_run_id (FK)
- flag_type
- severity
- description
- affected_demographics (JSON)
- sample_agent_reactions (JSON)
- detected_at

---

## 7. End-to-End Runtime Flow

### 7.1 Authentication
1. Register creates a user record with hashed password.
2. Login validates credentials and returns JWT access token.
3. Frontend stores token and includes it on subsequent API requests.

### 7.2 Project Creation and Video Processing
1. User uploads video in project creation request.
2. Backend validates extension and file size, stores file under uploads/user_id.
3. Project saved with status PENDING.
4. Celery process_video_task enqueued.
5. Worker sets PROCESSING, runs video analysis, stores context and duration.
6. Project transitions to READY when processing completes.

### 7.3 Simulation Execution
1. User starts simulation for READY project.
2. SimulationRun record created as PENDING.
3. Celery run_simulation_task enqueued.
4. Celery validates project/context, marks RUNNING.
5. Celery publishes simulation_requests payload.
6. Simulation worker consumes request, runs Ray orchestrator.
7. Worker publishes simulation_results payload on completion/failure.
8. Results listener consumes payload and persists outputs.
9. Frontend polls status and fetches detailed results.

### 7.4 Progress Reporting
- Simulation writes progress JSON to Redis key sim:{simulation_id}:status with TTL.
- Backend status endpoint reads this key for progress/current_day/active_agents.

---

## 8. API Surface Summary

Authentication:
- POST /auth/register
- POST /auth/login
- GET /auth/me

Projects:
- POST /projects
- GET /projects
- GET /projects/{project_id}
- DELETE /projects/{project_id}

Simulations:
- POST /simulations/{project_id}/start
- GET /simulations/{simulation_id}
- GET /simulations/{simulation_id}/status
- GET /simulations/{simulation_id}/results
- GET /simulations/project/{project_id}
- GET /simulations/{simulation_id}/map-data
- GET /simulations/{simulation_id}/agents/{agent_id}

System:
- GET /
- GET /health

---

## 9. Environment Configuration

Required for normal operation:
- DATABASE_URL
- REDIS_URL
- GEMINI_API_KEY (or GEMINI_API_KEYS strategy)
- QWEN_API_URL
- QWEN_MODEL_NAME
- JWT_SECRET

Optional/feature-dependent:
- MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_TRANSPORT, MQTT_PATH
- CHROMA_HOST, CHROMA_PORT, CHROMA_SSL
- AWS S3 variables (if object storage mode is enabled)
- DEFAULT_NUM_AGENTS, DEFAULT_SIMULATION_DAYS

Guidance:
- Do not commit live secrets into version control.
- Use separate environment values per developer or environment.
- Avoid sharing Redis broker credentials for isolated local development.

---

## 10. Deployment and Startup

### 10.1 Recommended local startup
Use start_services.bat to open all major services in separate terminals.

### 10.2 Manual startup
If needed, run API, Celery worker, simulation worker, and frontend in separate shells.

### 10.3 Local infrastructure mode
Use docker-compose.yml for local PostgreSQL, Redis, EMQX, and ChromaDB.

### 10.4 Cloud-backed mode
Default env examples are configured for cloud services (Neon/Upstash/Hugging Face).

---

## 11. Reliability and Failure Modes

### 11.1 Redis connection interruptions
Observed behavior:
- Celery can reconnect after transient broker disconnect.
- Simulation worker now uses reconnect loop and resubscribe behavior.
- Results listener may stop on connection error if not similarly hardened.

Impact:
- Simulation may finish but persistence can be delayed or missed if listener is down.

Recommendation:
- Add reconnect loop with backoff to results listener.
- Add operational monitoring for listener liveliness.

### 11.2 Shared broker cross-processing
When multiple developers share the same Redis broker and queue/channel names:
- Workers from one machine can process tasks triggered by another machine.

Recommendation:
- Isolate by queue/channel prefix and per-developer environment values.

### 11.3 Frontend dependency mismatch
If package declared in package.json is missing from node_modules, route compile fails.

Recommendation:
- Run npm install in frontend after dependency updates.
- Optionally validate critical packages in startup script before launching frontend.

---

## 12. Security Guidance

Authentication:
- JWT-based auth with Bearer tokens.
- Passwords are stored hashed.

Operational security:
- Replace default JWT secret for any shared/staging/production environment.
- Keep API keys and broker/database credentials in secret management.
- Never expose raw .env in docs, logs, screenshots, or commits.

Data handling:
- Uploaded media and generated outputs may contain sensitive campaign information.
- Apply retention policy for uploads and logs in production.

---

## 13. Performance Characteristics

Expected in dev mode:
- Next.js route compilation can be slow on first load, especially chart/map routes.
- Heavy pages include map and chart dependencies and client-side rendering costs.

Simulation runtime factors:
- Number of agents
- External LLM response latency
- ChromaDB availability and network latency
- Batch size and delay settings in simulation orchestrator

Tuning levers:
- Lower num_agents during development
- Use faster/local inference endpoints where possible
- Adjust batch size and delay based on rate limits and throughput

---

## 14. Operations Runbook

Daily checks:
1. Verify API health endpoint.
2. Verify Redis availability.
3. Confirm Celery worker and simulation worker are active.
4. Confirm results listener is running after API startup.

Incident response (simulation stuck RUNNING):
1. Check simulation worker logs for completion publish.
2. Check backend logs for results listener errors.
3. Validate Redis connectivity from backend and worker hosts.
4. If listener stopped, restart backend and re-run pending reconciliation if needed.

Incident response (module not found in frontend):
1. Run npm install in frontend.
2. If unresolved, remove node_modules and package-lock then reinstall.

---

## 15. Known Gaps and Suggested Improvements

1. Results listener reconnect resilience should match simulation worker robustness.
2. Video processing success criteria can be improved to avoid marking READY on degraded analysis outcomes.
3. Queue/channel names should be namespace-aware for multi-developer isolation.
4. Add structured observability (metrics/tracing) for queue latency and listener uptime.
5. Add integration tests for end-to-end simulation persistence path.

---

## 16. Glossary

VLM:
- Vision-Language Model used for video content analysis.

SimulationRun:
- A single execution instance of agent-based reaction modeling for one project.

Risk Flag:
- A detected demographic-specific negative reaction pattern above configured thresholds.

Map Data:
- Lightweight per-agent positional/opinion data used for frontend map rendering.

Agent States:
- Enriched per-agent result payload including profile, emotion, reasoning, and social links.

---

## 17. Document Maintenance

Owner:
- Engineering team maintaining backend/frontend/simulation services.

Update triggers:
- API changes
- Data model changes
- Infrastructure or startup process changes
- Reliability behavior changes

Recommended cadence:
- Update this document in every sprint where architecture or operational behavior changes.
