-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    subscription_tier VARCHAR(20) DEFAULT 'FREE' 
        CHECK (subscription_tier IN ('FREE', 'PRO', 'ENTERPRISE'))
);

-- Project metadata
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    video_path VARCHAR(500) NOT NULL,
    video_duration_seconds INT,
    vlm_generated_context TEXT,
    demographic_filter JSONB,
    status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_projects ON projects(user_id, created_at DESC);

-- Simulation runs (1 project can have multiple runs with different parameters)
CREATE TABLE simulation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    num_agents INT DEFAULT 1000,
    simulation_days INT DEFAULT 5,
    engagement_score FLOAT,
    sentiment_breakdown JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_runs ON simulation_runs(project_id, created_at DESC);

-- Agent interaction logs (high volume - consider partitioning in production)
CREATE TABLE agent_logs (
    id BIGSERIAL PRIMARY KEY,
    simulation_run_id UUID REFERENCES simulation_runs(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    event_type VARCHAR(30) NOT NULL 
        CHECK (event_type IN ('PERCEIVE', 'POST', 'IGNORE', 'BOYCOTT', 'ENDORSEMENT', 'OPINION_CHANGE')),
    event_data JSONB NOT NULL
);

CREATE INDEX idx_simulation_logs ON agent_logs(simulation_run_id, timestamp);
CREATE INDEX idx_agent_timeline ON agent_logs(agent_id, timestamp);

-- Risk flags (auto-detected controversies)
CREATE TABLE risk_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_run_id UUID REFERENCES simulation_runs(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT NOT NULL,
    affected_demographics JSONB,
    sample_agent_reactions JSONB,
    detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_risk_flags ON risk_flags(simulation_run_id, severity);
