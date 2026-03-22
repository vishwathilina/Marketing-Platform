"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


# ----- User Schemas -----
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


# ----- Custom Agent Schemas -----
class CustomAgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=16, le=90)
    gender: str
    location: str
    occupation: str
    education: str
    income_level: str
    religion: Optional[str] = None
    ethnicity: Optional[str] = None
    social_media_usage: str
    political_leaning: Optional[str] = None
    values: List[str] = Field(default=[])
    personality_traits: List[str] = Field(default=[])
    bio: Optional[str] = None

class CustomAgentResponse(BaseModel):
    id: UUID
    name: str
    age: int
    gender: str
    location: str
    occupation: str
    education: str
    income_level: str
    religion: Optional[str]
    ethnicity: Optional[str]
    social_media_usage: str
    political_leaning: Optional[str]
    values: List[str]
    personality_traits: List[str]
    bio: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    subscription_tier: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ----- Project Schemas -----
class DemographicFilter(BaseModel):
    age_range: Optional[List[int]] = None
    location: Optional[str] = None
    gender: Optional[str] = None
    values: Optional[List[str]] = None


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    demographic_filter: Optional[DemographicFilter] = None


class ProjectContextUpdate(BaseModel):
    vlm_generated_context: str = Field(min_length=1, max_length=50000)


class ProjectResponse(BaseModel):
    id: UUID
    title: str
    video_path: str
    video_duration_seconds: Optional[int]
    vlm_generated_context: Optional[str]
    demographic_filter: Optional[Dict[str, Any]]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    id: UUID
    title: str
    status: str
    created_at: datetime
    video_path: Optional[str] = None

    class Config:
        from_attributes = True


# ----- Simulation Schemas -----
class SimulationCreate(BaseModel):
    num_agents: int = Field(default=10, ge=1, le=10000)
    simulation_days: int = Field(default=5, ge=1, le=30)
    agent_ids: Optional[List[str]] = None
    use_custom_agents_only: bool = False
    demographic_filter: Optional[Dict[str, Any]] = None


class SentimentBreakdown(BaseModel):
    positive: int = 0
    neutral: int = 0
    negative: int = 0


class RiskFlagResponse(BaseModel):
    id: UUID
    flag_type: str
    severity: str
    description: str
    affected_demographics: Optional[Dict[str, Any]]
    sample_agent_reactions: Optional[List[Dict[str, Any]]]
    detected_at: datetime

    class Config:
        from_attributes = True


class SimulationResponse(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    num_agents: int
    simulation_days: int
    engagement_score: Optional[float]
    sentiment_breakdown: Optional[Dict[str, int]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SimulationStatusResponse(BaseModel):
    id: UUID
    status: str
    progress: Optional[int] = None
    current_day: Optional[int] = None
    active_agents: Optional[int] = None


class SimulationResultsResponse(BaseModel):
    simulation: SimulationResponse
    risk_flags: List[RiskFlagResponse]
    agent_sample: Optional[List[Dict[str, Any]]] = None
    opinion_trajectory: Optional[Dict[str, Any]] = None
    agent_states: Optional[List[Dict[str, Any]]] = None


# ----- Map Visualization Schemas -----
class MapAgentData(BaseModel):
    agent_id: str
    coordinates: List[float]
    opinion: str
    friends: List[str]


class MapDataResponse(BaseModel):
    map_data: List[MapAgentData]


class AgentProfileData(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None
    education: Optional[str] = None
    income_level: Optional[str] = None
    religion: Optional[str] = None
    ethnicity: Optional[str] = None
    social_media_usage: Optional[str] = None
    political_leaning: Optional[str] = None
    values: List[str] = []
    personality_traits: List[str] = []


class AgentDetailResponse(BaseModel):
    agent_id: str
    coordinates: List[float]
    opinion: str
    emotion: str
    emotion_intensity: float = 0
    reasoning: str = ""
    friends: List[str] = []
    profile: AgentProfileData
