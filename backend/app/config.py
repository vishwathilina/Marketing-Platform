"""
Configuration settings loaded from environment variables
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


# Determine .env path - check both current dir and parent dir
def find_env_file():
    """Find .env file in current or parent directory"""
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Check backend directory
    if os.path.exists(os.path.join(current_dir, ".env")):
        return os.path.join(current_dir, ".env")
    
    # Check parent directory (agent-society-platform)
    parent_dir = os.path.dirname(current_dir)
    if os.path.exists(os.path.join(parent_dir, ".env")):
        return os.path.join(parent_dir, ".env")
    
    return ".env"


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://agentsociety:dev_password@localhost:5432/agentsociety_db"
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # MQTT
    mqtt_broker_host: str = "localhost"
    mqtt_broker_port: int = 1883
    
    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    
    # AWS S3 (optional)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = "agentsociety-videos-dev"
    aws_region: str = "ap-south-1"
    
    # Google Gemini API
    gemini_api_key: str = ""
    
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

