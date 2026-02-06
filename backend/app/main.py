"""
AgentSociety Marketing Platform - FastAPI Backend
"""
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.config import get_settings
from app.routers import auth_router, projects_router, simulations_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting AgentSociety API...")
    
    # Create upload directory
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    yield
    
    # Shutdown
    logger.info("Shutting down AgentSociety API...")


# Create FastAPI app
app = FastAPI(
    title="AgentSociety Marketing Platform",
    description="AI-powered marketing simulation platform that simulates 1,000+ AI agents reacting to video advertisements",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(simulations_router)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AgentSociety API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    from app.database import engine
    
    health = {
        "api": "healthy",
        "database": "unknown",
        "redis": "unknown"
    }
    
    # Check database
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
            health["database"] = "healthy"
    except Exception as e:
        health["database"] = f"unhealthy: {str(e)}"
    
    # Check Redis
    try:
        import redis
        r = redis.from_url(settings.redis_url)
        r.ping()
        health["redis"] = "healthy"
    except Exception as e:
        health["redis"] = f"unhealthy: {str(e)}"
    
    return health
