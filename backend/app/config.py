"""
Configuration settings loaded from environment variables
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


# Determine .env path - check both current dir and parent dir
def find_env_file():
    """Find .env file in app, backend, or project root directory"""
    app_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(app_dir)
    project_root_dir = os.path.dirname(backend_dir)

    # Check app directory (this folder)
    if os.path.exists(os.path.join(app_dir, ".env")):
        return os.path.join(app_dir, ".env")

    # Check backend directory
    if os.path.exists(os.path.join(backend_dir, ".env")):
        return os.path.join(backend_dir, ".env")

    # Check project root directory
    if os.path.exists(os.path.join(project_root_dir, ".env")):
        return os.path.join(project_root_dir, ".env")
    
    return ".env"


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://agentsociety:dev_password@localhost:5433/agentsociety_db"
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # MQTT
    mqtt_broker_host: str = "localhost"
    mqtt_broker_port: int = 1883
    mqtt_transport: str = "tcp"
    mqtt_path: str = ""
    
    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    chroma_ssl: bool = False
    
    # AWS S3 (optional)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = "agentsociety-videos-dev"
    aws_region: str = "ap-south-1"
    
    # Google Gemini API (used by VLM video analysis)
    gemini_api_key: str = ""
    gemini_api_keys: str = ""  # comma-separated keys for rotation
    
    # Qwen LLM (HuggingFace Space - Ollama API, used by simulation agents)
    qwen_api_url: str = "https://vish85521-doc.hf.space/api/generate"
    qwen_model_name: str = "qwen3.5:397b-cloud"
    
    # Security
    jwt_secret: str = "change_this_to_a_random_32_character_string"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24
    
    # Simulation
    default_num_agents: int = 10
    default_simulation_days: int = 5
    
    # File Storage
    upload_dir: str = "uploads"
    
    class Config:
        env_file = find_env_file()
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

