-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    subscription_tier VARCHAR(20) DEFAULT 'FREE' 
        CHECK (subscription_tier IN ('FREE', 'PRO', 'ENTERPRISE'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Projects Table (Campaigns/Advertisements)
CREATE TABLE IF NOT EXISTS projects (
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

CREATE INDEX IF NOT EXISTS idx_user_projects ON projects(user_id, created_at DESC);

-- 3. Custom Agents Table (Reusable Agent Templates)
CREATE TABLE IF NOT EXISTS custom_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    gender VARCHAR(20) NOT NULL,
    location VARCHAR(100) NOT NULL,
    occupation VARCHAR(100) NOT NULL,
    education VARCHAR(100) NOT NULL,
    income_level VARCHAR(50) NOT NULL,
    religion VARCHAR(50),
    ethnicity VARCHAR(50),
    social_media_usage VARCHAR(50) NOT NULL,
    political_leaning VARCHAR(50),
    values JSONB NOT NULL DEFAULT '[]',
    personality_traits JSONB NOT NULL DEFAULT '[]',
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_custom_agents ON custom_agents(user_id);

-- 4. Simulation Runs Table
CREATE TABLE IF NOT EXISTS simulation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    num_agents INT DEFAULT 1000,
    simulation_days INT DEFAULT 5,
    
    -- Analytics Results
    engagement_score FLOAT,
    sentiment_breakdown JSONB,
    opinion_trajectory JSONB,
    
    -- Visualization Data
    map_data JSONB,           -- lightweight per-agent coords/opinion/friends for the map
    agent_states JSONB,       -- full snapshot of agent profiles/emotions/reasoning
    
    -- Configuration
    use_custom_agents_only BOOLEAN DEFAULT FALSE,
    agent_ids JSONB,          -- list of custom agent IDs used in this run
    
    -- Timestamps
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_runs ON simulation_runs(project_id, created_at DESC);

-- 5. Agent Interaction Logs (Raw Events)
CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGSERIAL PRIMARY KEY,
    simulation_run_id UUID REFERENCES simulation_runs(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    event_type VARCHAR(30) NOT NULL 
        CHECK (event_type IN ('PERCEIVE', 'POST', 'IGNORE', 'BOYCOTT', 'ENDORSEMENT', 'OPINION_CHANGE', 'ERROR')),
    event_data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_logs ON agent_logs(simulation_run_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_timeline ON agent_logs(agent_id, timestamp);

-- 6. Risk Flags (Detected Controversies)
CREATE TABLE IF NOT EXISTS risk_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_run_id UUID REFERENCES simulation_runs(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT NOT NULL,
    affected_demographics JSONB,
    sample_agent_reactions JSONB,
    detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_flags ON risk_flags(simulation_run_id, severity);
