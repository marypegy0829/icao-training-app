
-- ==============================================================================
-- ICAO Level 5 Examiner - DATABASE SETUP SCRIPT
-- ==============================================================================

-- 1. Create independent Schema (for isolation from other apps)
CREATE SCHEMA IF NOT EXISTS icao5_trainer;

-- 2. Grant Permissions
GRANT USAGE ON SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;

-- 3. Create Profiles Table (Optimized for Cost & Performance)
CREATE TABLE IF NOT EXISTS icao5_trainer.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Links directly to Supabase Auth Users with Cascade Delete
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT,
    airline TEXT,
    aircraft_type TEXT,
    flight_level TEXT,
    current_icao_level SMALLINT DEFAULT 4,
    
    -- Stats
    flight_hours NUMERIC(10,1) DEFAULT 0,
    total_sorties INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    
    -- Skills Radar Data (JSONB)
    skills JSONB DEFAULT '{"Pronunciation": 3, "Structure": 3, "Vocabulary": 3, "Fluency": 3, "Comprehension": 3, "Interactions": 3}'::jsonb,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT idx_profiles_user_id UNIQUE (user_id)
);

-- 4. Create Training Logs Table
CREATE TABLE IF NOT EXISTS icao5_trainer.training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    scenario_title TEXT,
    phase TEXT,
    score SMALLINT,
    duration TEXT,
    
    -- Store full assessment JSON here
    details JSONB, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON icao5_trainer.training_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON icao5_trainer.training_logs(created_at DESC);

-- 6. Row Level Security (RLS)
ALTER TABLE icao5_trainer.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.training_logs ENABLE ROW LEVEL SECURITY;

-- 7. Policies
-- Profiles
CREATE POLICY "Users can view own profile" ON icao5_trainer.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON icao5_trainer.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON icao5_trainer.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Logs
CREATE POLICY "Users can view own logs" ON icao5_trainer.training_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON icao5_trainer.training_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- IMPORTANT: Go to Supabase -> Settings -> API -> Exposed Schemas -> Add "icao5_trainer"
