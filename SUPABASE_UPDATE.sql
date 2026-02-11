
-- ==============================================================================
-- ICAO Level 5 Examiner - ROBUST DATABASE SCHEMA (v2.1)
-- 描述: 重构数据库结构，移除“最低成本”限制，采用企业级设计原则。
-- 修复: 解决了 idx_profiles_user_id 索引名冲突的问题。
-- ==============================================================================

-- 1. 初始化环境 (重置 Schema)
-- 警告: 这将删除所有现有数据！仅在开发阶段或完全重置时使用。
DROP SCHEMA IF EXISTS icao5_trainer CASCADE;
CREATE SCHEMA icao5_trainer;

-- 2. 授权 (允许 Supabase API 访问)
GRANT USAGE ON SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;

-- ==============================================================================
-- 辅助函数：自动更新 updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION icao5_trainer.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 表结构设计
-- ==============================================================================

-- A. 用户档案 (Profiles)
CREATE TABLE icao5_trainer.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 基本信息
    name TEXT DEFAULT 'Pilot',
    airline TEXT,
    aircraft_type TEXT,
    flight_level TEXT DEFAULT 'Cadet',
    current_icao_level SMALLINT DEFAULT 4 CHECK (current_icao_level BETWEEN 1 AND 6),
    
    -- 统计数据
    flight_hours NUMERIC(10, 2) DEFAULT 0,
    total_sorties INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    
    -- 技能雷达数据
    skills JSONB DEFAULT '{
        "Pronunciation": 3, 
        "Structure": 3, 
        "Vocabulary": 3, 
        "Fluency": 3, 
        "Comprehension": 3, 
        "Interactions": 3
    }'::jsonb,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 约束: user_id 必须唯一。这会自动创建一个名为 idx_profiles_user_id 的唯一索引。
    CONSTRAINT idx_profiles_user_id UNIQUE (user_id)
);

-- 触发器：自动更新 updated_at
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON icao5_trainer.profiles
FOR EACH ROW
EXECUTE FUNCTION icao5_trainer.handle_updated_at();

-- B. 训练记录 (Training Logs)
CREATE TABLE icao5_trainer.training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 场景上下文
    scenario_title TEXT NOT NULL,
    phase TEXT,
    
    -- 表现数据
    score SMALLINT CHECK (score BETWEEN 0 AND 6),
    duration TEXT,           -- 显示用字符串 (例如 "3m 20s")
    duration_seconds INTEGER, -- 统计用秒数
    
    -- 完整评估报告
    details JSONB, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 索引优化 (Performance)
-- ==============================================================================
-- 注意: idx_profiles_user_id 已经由 UNIQUE 约束自动创建，无需再次创建。

-- 为 logs 表创建索引
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON icao5_trainer.training_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at_desc ON icao5_trainer.training_logs(created_at DESC);
-- GIN 索引用于加速 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_logs_details ON icao5_trainer.training_logs USING GIN (details);

-- ==============================================================================
-- 安全策略 (Row Level Security)
-- ==============================================================================
ALTER TABLE icao5_trainer.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.training_logs ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
CREATE POLICY "Users can view own profile" 
ON icao5_trainer.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON icao5_trainer.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON icao5_trainer.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Logs 策略
CREATE POLICY "Users can view own logs" 
ON icao5_trainer.training_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" 
ON icao5_trainer.training_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 说明
-- ==============================================================================
-- 执行此脚本后，请务必在 Supabase 控制台的 API 设置中，
-- 确保 "icao5_trainer" 仍然在 "Exposed Schemas" 列表中。
