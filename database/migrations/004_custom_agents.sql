CREATE TABLE IF NOT EXISTS custom_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Note: user_id is referenced from users(id), which we will let alembic handle or standard neon db.
-- Adding columns to simulation_runs
ALTER TABLE simulation_runs ADD COLUMN IF NOT EXISTS use_custom_agents_only BOOLEAN DEFAULT FALSE;
ALTER TABLE simulation_runs ADD COLUMN IF NOT EXISTS agent_ids JSONB;
