# AgentSociety Marketing Platform

<div align="center">

🤖 **AI-Powered Marketing Risk Simulation**

*Simulate 1,000+ AI agents reacting to video advertisements before launch*

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js)](https://nextjs.org/)
[![Ray](https://img.shields.io/badge/Ray-028CF0?style=flat&logo=ray)](https://www.ray.io/)

</div>

---

## 🎯 Overview

AgentSociety is a marketing simulation platform that uses AI agents to predict how different demographic groups will react to your video advertisements. Detect potential PR crises before they happen!

### Key Features
- 🎬 **Video Analysis** - Automatically analyze ad content using Google Gemini Vision
- 👥 **Agent Simulation** - Simulate 10-1,000+ diverse AI personas
- 📊 **Risk Detection** - Identify controversial content by demographic segment
- 📈 **Virality Scoring** - Predict how content will spread

---

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Browser   │─────▶│   Next.js    │─────▶│     FastAPI     │
│  (User UI)  │◀─────│  Frontend    │◀─────│   Orchestrator  │
└─────────────┘      └──────────────┘      └────────┬────────┘
                                                     │
                     ┌───────────────────────────────┼───────────────┐
                     │                               │               │
                     ▼                               ▼               ▼
              ┌──────────────┐              ┌─────────────┐  ┌──────────────┐
              │  Gemini API  │              │ Ray Cluster │  │  PostgreSQL  │
              │  (Vision)    │              │  (Agents)   │  │   Database   │
              └──────────────┘              └──────┬──────┘  └──────────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                              ┌─────────┐    ┌─────────┐    ┌─────────┐
                              │ Agent 1 │    │ Agent 2 │... │Agent N  │
                              └─────────┘    └─────────┘    └─────────┘
```

---

## 📋 Prerequisites

- **Docker Desktop** (with Docker Compose)
- **Python 3.10+**
- **Node.js 18+**
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))

---

## 🚀 Quick Start

### 1. Clone & Configure Environment

```bash
# Clone the repository
git clone <your-repo-url>
cd agent-society-platform

# Copy environment template
cp .env.example .env
```

Edit `.env` with your API keys and service configurations. The default `.env` is pre-configured with cloud services (Neon DB, Upstash Redis, Hugging Face spaces):
```env
# Required - Google Gemini APIs (For VLM analysis)
GEMINI_API_KEY=your_primary_key
GEMINI_API_KEYS=key1,key2,key3 # For automatic quota rotation

# Required - External Services (Pre-configured in .env)
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
MQTT_BROKER_HOST=...
CHROMA_HOST=...

# Required - Qwen LLM (For Agent Generation)
QWEN_API_URL=https://...
QWEN_MODEL_NAME=qwen3.5:397b-cloud

# Optional - Change default JWT secret for production
JWT_SECRET=your_secure_secret_here
```

### 2. Start Docker Infrastructure (Optional)

> **Note**: The provided `.env` file is pre-configured to use cloud-hosted services (Neon DB PostgreSQL, Upstash Redis, Hugging Face EMQX and ChromaDB). If you use these cloud services, you can **skip this docker step** and proceed to Step 3.

If you prefer to run services locally, you can use Docker Compose (ensure you update the `.env` file to point to `localhost`):

```bash
# Start all required services (PostgreSQL, Redis, EMQX, ChromaDB)
docker-compose up -d

# Verify all containers are running
docker-compose ps
```

Expected output:
| Container | Port | Status |
|-----------|------|--------|
| agentsociety-postgres | 5432 | healthy |
| agentsociety-redis | 6379 | healthy |
| agentsociety-emqx | 1883, 18083 | healthy |
| agentsociety-chromadb | 8000 | running |

### 3. Setup Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt
```

### 4. Setup Frontend

```bash
cd frontend
npm install
cd ..
```

### 5. Start All Services

You need **3 terminal windows**:

**Terminal 1 - Backend API:**
```bash
.\venv\Scripts\activate  # Windows
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

**Terminal 2 - Celery Worker (for video processing):**
```bash
.\venv\Scripts\activate  # Windows
cd backend
celery -A app.tasks worker --loglevel=info --pool=solo
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

### 6. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main application UI |
| **Backend API** | http://localhost:8001 | REST API |
| **API Docs** | http://localhost:8001/docs | Swagger documentation |
| **EMQX Dashboard** | http://localhost:18083 | MQTT monitoring (admin/public) |

---

## 📁 Project Structure

```
agent-society-platform/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # Application entry point
│   │   ├── routers/           # API endpoints (auth, projects, simulations)
│   │   ├── models/            # SQLAlchemy database models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # Business logic (VLM, auth)
│   │   └── tasks.py           # Celery background tasks
│
├── frontend/                   # Next.js 14 frontend
│   ├── app/                   # App router pages
│   │   ├── login/             # Authentication pages
│   │   ├── dashboard/         # Main dashboard
│   │   └── register/          # User registration
│   └── lib/                   # API client & utilities
│
├── simulation/                 # Ray-based agent simulation
│   ├── agents/                # Agent logic & memory
│   ├── run_simulation.py      # Simulation orchestrator
│   ├── llm_client.py          # Gemini API integration
│   └── mqtt_client.py         # MQTT communication
│
├── database/
│   └── migrations/            # SQL schema files
│
├── docker-compose.yml         # Infrastructure services
├── requirements.txt           # Unified Python dependencies
├── .env.example               # Environment template
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection (Neon DB or local docker) |
| `REDIS_URL` | **Yes** | Redis connection (Upstash or local docker) |
| `MQTT_BROKER_HOST` / `_PORT` | **Yes** | EMQX MQTT connection details |
| `CHROMA_HOST` / `_PORT` / `_SSL`| **Yes** | ChromaDB vector database connection |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key (for VLM analysis) |
| `GEMINI_API_KEYS` | No | Multiple Gemini keys (comma-separated) for quota rotation |
| `QWEN_API_URL` | **Yes** | Qwen LLM API URL for agent generation |
| `QWEN_MODEL_NAME` | **Yes** | Qwen LLM model name |
| `JWT_SECRET` | No | Secret for JWT tokens (default provided) |
| `DEFAULT_NUM_AGENTS` | No | Default agent count (default: 10) |
| `DEFAULT_SIMULATION_DAYS`| No | Simulation duration (default: 5) |

---

## 📖 Usage Guide

### 1. Register & Login
- Navigate to http://localhost:3000
- Create an account or login

### 2. Create a Project
- Click "New Project"
- Upload a video advertisement (MP4, MOV, AVI, WebM)
- Wait for video analysis (1-3 minutes)

### 3. Run Simulation
- Once video is processed (status: "READY")
- Configure agent count and simulation days
- Click "Start Simulation"

### 4. View Results
- **Virality Score**: 0-100 prediction of viral potential
- **Sentiment Breakdown**: Positive/Neutral/Negative reactions
- **Risk Flags**: Identified controversial elements by demographic

---

## 🛠️ Troubleshooting

### Video stuck at "Processing"
**Cause**: Celery worker not running
```bash
# Start Celery in a new terminal
.\venv\Scripts\activate
cd backend
celery -A app.tasks worker --loglevel=info --pool=solo
```

### Database connection failed
**Cause**: PostgreSQL container not running (if using local database)
```bash
docker-compose up -d postgres
docker-compose logs postgres
```

### CORS errors in browser
**Cause**: Backend not running on correct port
```bash
# Ensure backend runs on port 8001
python -m uvicorn app.main:app --reload --port 8001
```

### Gemini API errors
**Cause**: Invalid or missing API key
- Verify `GEMINI_API_KEY` in `.env`
- Check API key at https://makersuite.google.com/app/apikey

---

## 🧪 API Quick Reference

### Authentication
```bash
# Register
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Login
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Health Check
```bash
curl http://localhost:8001/health
# {"api":"healthy","database":"healthy","redis":"healthy"}
```

---

## 📊 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | FastAPI, Python 3.10+, Celery |
| Database | PostgreSQL 15, ChromaDB (vectors), Redis |
| Simulation | Ray, MQTT (EMQX) |
| AI/ML | Google Gemini Vision API |
| Infrastructure | Docker, Docker Compose |

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the AgentSociety Research Project**

</div>
