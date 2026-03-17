"""
SQLAlchemy models for the AgentSociety platform
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, JSON, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    subscription_tier = Column(String(20), default="FREE")
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    video_path = Column(String(500), nullable=False)
    video_duration_seconds = Column(Integer, nullable=True)
    vlm_generated_context = Column(Text, nullable=True)
    demographic_filter = Column(JSON, nullable=True)
    status = Column(String(20), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="projects")
    simulation_runs = relationship("SimulationRun", back_populates="project", cascade="all, delete-orphan")


class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="PENDING")
    num_agents = Column(Integer, default=1000)
    simulation_days = Column(Integer, default=5)
    engagement_score = Column(Float, nullable=True)
    sentiment_breakdown = Column(JSON, nullable=True)
    map_data = Column(JSON, nullable=True)          # lightweight per-agent coords/opinion/friends
    agent_states = Column(JSON, nullable=True)       # full agent profile/emotion/reasoning
    opinion_trajectory = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="simulation_runs")
    agent_logs = relationship("AgentLog", back_populates="simulation_run", cascade="all, delete-orphan")
    risk_flags = relationship("RiskFlag", back_populates="simulation_run", cascade="all, delete-orphan")


class AgentLog(Base):
    __tablename__ = "agent_logs"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    simulation_run_id = Column(UUID(as_uuid=True), ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String(30), nullable=False)
    event_data = Column(JSON, nullable=False)
    
    # Relationships
    simulation_run = relationship("SimulationRun", back_populates="agent_logs")


class RiskFlag(Base):
    __tablename__ = "risk_flags"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    simulation_run_id = Column(UUID(as_uuid=True), ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False)
    flag_type = Column(String(50), nullable=False)
    severity = Column(String(10), nullable=False)
    description = Column(Text, nullable=False)
    affected_demographics = Column(JSON, nullable=True)
    sample_agent_reactions = Column(JSON, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    simulation_run = relationship("SimulationRun", back_populates="risk_flags")
