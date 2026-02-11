
-- ==============================================================================
-- ICAO Level 5 Examiner - DATABASE RESET & SETUP SCRIPT
-- 修复错误: column "user_id" does not exist
-- 操作: 彻底清除旧的 icao5_trainer 模式并重建，确保结构正确且成本最低。
-- ==============================================================================

-- 1. 🚨 危险操作：清除旧模式及其所有内容 (确保环境干净)
DROP SCHEMA IF EXISTS icao5_trainer CASCADE;

-- 2. 重建 Schema
CREATE SCHEMA icao5_trainer;

-- 3. 授予权限 (允许 Supabase API 访问)
GRANT USAGE ON SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;

-- 4. 创建 Profiles 表 (存储成本优化版)
CREATE TABLE icao5_trainer.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 关键修正：使用 UUID 类型直接关联 auth.users，启用级联删除节省空间
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT,
    airline TEXT,
    aircraft_type TEXT,
    flight_level TEXT,
    current_icao_level SMALLINT DEFAULT 4,
    
    -- 统计数据
    flight_hours NUMERIC(10,1) DEFAULT 0,
    total_sorties INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    
    -- 使用 JSONB 存储技能雷达图数据，避免创建多个 float 列
    skills JSONB DEFAULT '{"Pronunciation": 3, "Structure": 3, "Vocabulary": 3, "Fluency": 3, "Comprehension": 3, "Interactions": 3}'::jsonb,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 确保每个用户只有一个档案
    CONSTRAINT idx_profiles_user_id UNIQUE (user_id)
);

-- 5. 创建 Training Logs 表 (无音频文件，仅存文本报告)
CREATE TABLE icao5_trainer.training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    scenario_title TEXT,
    phase TEXT,
    score SMALLINT,
    duration TEXT,
    
    -- 核心：所有评估详情（大段文本、JSON结构）都存这里
    details JSONB, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 创建索引 (仅针对高频过滤字段)
CREATE INDEX idx_logs_user_id ON icao5_trainer.training_logs(user_id);
CREATE INDEX idx_logs_created_at ON icao5_trainer.training_logs(created_at DESC);

-- 7. 启用行级安全 (RLS) - 必须开启
ALTER TABLE icao5_trainer.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.training_logs ENABLE ROW LEVEL SECURITY;

-- 8. 配置安全策略 (Policies)

-- Profiles 表策略
CREATE POLICY "Users can view own profile" 
ON icao5_trainer.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON icao5_trainer.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON icao5_trainer.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Training Logs 表策略
CREATE POLICY "Users can view own logs" 
ON icao5_trainer.training_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" 
ON icao5_trainer.training_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 执行后检查清单:
-- 1. 确保没有报错。
-- 2. 进入 Supabase 后台 -> Project Settings -> API。
-- 3. 在 "Exposed Schemas" 设置中，确保 "icao5_trainer" 已被添加/勾选。
--    (如果不添加，前端会报 "Schema not found" 错误)
-- ==============================================================================
