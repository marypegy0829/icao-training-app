
-- ==============================================================================
-- ICAO Level 5 Examiner - 数据库架构升级 (v3.0)
-- 包含三个核心表：个人信息(profiles), 机场信息(airports), 测评历史(training_logs)
-- ==============================================================================

-- 1. 初始化环境 (Schema Setup)
CREATE SCHEMA IF NOT EXISTS icao5_trainer;

-- 授权访问
GRANT USAGE ON SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA icao5_trainer TO anon, authenticated, service_role;

-- 辅助函数：自动更新 updated_at
CREATE OR REPLACE FUNCTION icao5_trainer.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 表 1: 个人信息 (Personal Information) - profiles
-- 存储飞行员的基本资料、等级、技能雷达图数据及统计信息
-- ==============================================================================
CREATE TABLE IF NOT EXISTS icao5_trainer.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 基础身份信息
    name TEXT DEFAULT 'Pilot',
    airline TEXT,
    aircraft_type TEXT,          -- 机型 (e.g., A320, B737)
    flight_level TEXT DEFAULT 'Cadet', -- 职级 (e.g., Captain, FO)
    current_icao_level SMALLINT DEFAULT 4,
    avatar_url TEXT,             -- 用户头像链接
    
    -- 训练统计
    flight_hours NUMERIC(10, 2) DEFAULT 0, -- 总训练小时数
    total_sorties INTEGER DEFAULT 0,       -- 总起降/训练次数
    streak INTEGER DEFAULT 0,              -- 连续打卡天数
    
    -- 核心能力 (六大维度雷达图数据)
    skills JSONB DEFAULT '{
        "Pronunciation": 3, 
        "Structure": 3, 
        "Vocabulary": 3, 
        "Fluency": 3, 
        "Comprehension": 3, 
        "Interactions": 3
    }'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT idx_profiles_user_id UNIQUE (user_id)
);

-- 触发器
DROP TRIGGER IF EXISTS set_profiles_updated_at ON icao5_trainer.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON icao5_trainer.profiles
FOR EACH ROW
EXECUTE FUNCTION icao5_trainer.handle_updated_at();

-- ==============================================================================
-- 表 2: 机场信息 (Airport Information) - airports (新增)
-- 存储全球机场数据，支持场景生成和驾驶舱频率显示
-- ==============================================================================
CREATE TABLE IF NOT EXISTS icao5_trainer.airports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icao_code TEXT UNIQUE NOT NULL, -- e.g., ZBAA
    iata_code TEXT,                 -- e.g., PEK
    
    -- 基础信息
    name TEXT NOT NULL,             -- 机场名称
    city TEXT,
    country TEXT,
    region_code TEXT,               -- 用于口音匹配 (Z=中国, K=美国, E=欧洲等)
    elevation_ft INTEGER,
    image_url TEXT,                 -- 机场平面图或封面图
    
    -- 运行数据 (JSONB 格式以便扩展)
    runways JSONB,    -- 跑道列表 e.g., ["36R/18L", "01/19"]
    frequencies JSONB, -- 通信频率 e.g., {"TOWER": "118.1", "APP": "119.7", "ATIS": "128.4"}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 表 3: 测评历史 (Assessment History) - training_logs
-- 存储所有的训练和考试记录，包括详细的 AI 评估报告
-- ==============================================================================
CREATE TABLE IF NOT EXISTS icao5_trainer.training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 场景上下文
    scenario_title TEXT NOT NULL,
    phase TEXT,               -- 飞行阶段
    session_type TEXT DEFAULT 'TRAINING', -- 'TRAINING' 或 'ASSESSMENT'
    
    -- 结果数据
    score SMALLINT,           -- 总体评分 (1-6)
    duration TEXT,            -- 显示时长 (e.g., "5m 20s")
    duration_seconds INTEGER, -- 秒数
    
    -- AI 生成的完整 JSON 报告
    details JSONB, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON icao5_trainer.training_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at_desc ON icao5_trainer.training_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_airports_icao ON icao5_trainer.airports(icao_code);

-- ==============================================================================
-- 安全策略 (Row Level Security)
-- ==============================================================================
ALTER TABLE icao5_trainer.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.airports ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.training_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles 策略 (用户只能管理自己的档案)
DROP POLICY IF EXISTS "Users can view own profile" ON icao5_trainer.profiles;
CREATE POLICY "Users can view own profile" ON icao5_trainer.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON icao5_trainer.profiles;
CREATE POLICY "Users can update own profile" ON icao5_trainer.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON icao5_trainer.profiles;
CREATE POLICY "Users can insert own profile" ON icao5_trainer.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Airports 策略 (公开只读，仅管理员可写-此处简化为暂不开放写权限给普通用户)
DROP POLICY IF EXISTS "Airports are public readable" ON icao5_trainer.airports;
CREATE POLICY "Airports are public readable" ON icao5_trainer.airports FOR SELECT USING (true);

-- 3. Training Logs 策略 (用户只能查看自己的历史)
DROP POLICY IF EXISTS "Users can view own logs" ON icao5_trainer.training_logs;
CREATE POLICY "Users can view own logs" ON icao5_trainer.training_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own logs" ON icao5_trainer.training_logs;
CREATE POLICY "Users can insert own logs" ON icao5_trainer.training_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 数据预置 (Seed Data for Airports)
-- ==============================================================================
INSERT INTO icao5_trainer.airports (icao_code, iata_code, name, city, country, region_code, runways, frequencies)
VALUES 
('ZBAA', 'PEK', 'Beijing Capital Intl', 'Beijing', 'China', 'Z', '["36R/18L", "36L/18R", "01/19"]', '{"TOWER": "118.1", "APP": "119.7", "GND": "121.7"}'),
('ZSPD', 'PVG', 'Shanghai Pudong Intl', 'Shanghai', 'China', 'Z', '["17L/35R", "17R/35L", "16L/34R"]', '{"TOWER": "118.5", "APP": "120.3", "GND": "121.8"}'),
('ZSQD', 'TAO', 'Qingdao Jiaodong Intl', 'Qingdao', 'China', 'Z', '["17/35", "16/34"]', '{"TOWER": "118.2", "APP": "124.3", "GND": "121.6"}'),
('VHHH', 'HKG', 'Hong Kong Intl', 'Hong Kong', 'China', 'V', '["07L/25R", "07R/25L"]', '{"TOWER": "118.7", "APP": "119.1", "GND": "122.0"}'),
('RKSI', 'ICN', 'Incheon Intl', 'Seoul', 'South Korea', 'RK', '["15L/33R", "15R/33L", "16/34"]', '{"TOWER": "118.2", "APP": "119.75", "GND": "121.4"}'),
('RJTT', 'HND', 'Tokyo Haneda', 'Tokyo', 'Japan', 'RJ', '["16L/34R", "16R/34L", "04/22", "05/23"]', '{"TOWER": "118.1", "APP": "119.1", "GND": "121.7"}'),
('KJFK', 'JFK', 'John F. Kennedy Intl', 'New York', 'USA', 'K', '["04L/22R", "04R/22L", "13L/31R", "13R/31L"]', '{"TOWER": "119.1", "APP": "127.4", "GND": "121.9"}'),
('EGLL', 'LHR', 'London Heathrow', 'London', 'UK', 'E', '["09L/27R", "09R/27L"]', '{"TOWER": "118.5", "APP": "120.4", "GND": "121.9"}'),
('OMDB', 'DXB', 'Dubai Intl', 'Dubai', 'UAE', 'O', '["12L/30R", "12R/30L"]', '{"TOWER": "118.75", "APP": "124.9", "GND": "121.6"}')
ON CONFLICT (icao_code) DO NOTHING;
