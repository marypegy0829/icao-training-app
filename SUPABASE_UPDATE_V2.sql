
-- ==============================================================================
-- ICAO Level 5 Examiner - 数据库架构升级 (v3.1)
-- 新增：场景库(scenarios), 错题本(mistake_book), 成就系统(achievements)
-- ==============================================================================

-- 确保 Schema 存在
CREATE SCHEMA IF NOT EXISTS icao5_trainer;

-- ==============================================================================
-- 表 4: 训练场景库 (Scenarios)
-- 替代前端硬编码的 trainingData.ts，支持动态更新题库
-- ==============================================================================
CREATE TABLE IF NOT EXISTS icao5_trainer.scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,    -- 对应前端 ID (e.g., 'eng_fire')
    category TEXT NOT NULL,       -- 分类 (e.g., 'Powerplant')
    title TEXT NOT NULL,          -- 标题
    details TEXT NOT NULL,        -- 情景描述
    phase TEXT NOT NULL,          -- 飞行阶段 (e.g., 'Takeoff & Climb')
    weather TEXT DEFAULT 'VMC',   -- 气象条件
    difficulty_level TEXT DEFAULT 'Medium', -- 难度标记
    is_active BOOLEAN DEFAULT true, -- 上架状态
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_scenarios_category ON icao5_trainer.scenarios(category);
CREATE INDEX IF NOT EXISTS idx_scenarios_phase ON icao5_trainer.scenarios(phase);

-- ==============================================================================
-- 表 5: 错题本 (Mistake Book)
-- 用于收藏 Deep Analysis 中的错误点，进行针对性复习
-- ==============================================================================
CREATE TABLE IF NOT EXISTS icao5_trainer.mistake_book (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    source_scenario_title TEXT,    -- 来源场景
    original_text TEXT NOT NULL,   -- 用户说错的话
    correction TEXT NOT NULL,      -- 正确标准术语
    issue_type TEXT,               -- 错误类型 (Pronunciation, Vocabulary...)
    explanation TEXT,              -- AI 的解释/理论
    
    is_mastered BOOLEAN DEFAULT false, -- 用户是否已掌握
    review_count INTEGER DEFAULT 0,    -- 复习次数
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_mistake_book_user ON icao5_trainer.mistake_book(user_id);

-- ==============================================================================
-- 表 6: 成就/徽章系统 (Achievements)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS icao5_trainer.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,      -- e.g., 'FIRST_SOLO'
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,                  -- 徽章图片
    criteria JSONB,                 -- 达成条件 (预留)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户解锁成就关联表
CREATE TABLE IF NOT EXISTS icao5_trainer.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES icao5_trainer.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT idx_user_achievement_unique UNIQUE (user_id, achievement_id)
);

-- ==============================================================================
-- Row Level Security (RLS) 安全策略
-- ==============================================================================
ALTER TABLE icao5_trainer.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.mistake_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.user_achievements ENABLE ROW LEVEL SECURITY;

-- 1. Scenarios: 所有人可读，仅管理员可写 (此处简化为全员只读)
DROP POLICY IF EXISTS "Scenarios are public readable" ON icao5_trainer.scenarios;
CREATE POLICY "Scenarios are public readable" ON icao5_trainer.scenarios FOR SELECT USING (true);

-- 2. Mistake Book: 用户只能管理自己的错题
DROP POLICY IF EXISTS "Users manage own mistakes" ON icao5_trainer.mistake_book;
CREATE POLICY "Users manage own mistakes" ON icao5_trainer.mistake_book USING (auth.uid() = user_id);

-- 3. Achievements: 公开可读
DROP POLICY IF EXISTS "Achievements public" ON icao5_trainer.achievements;
CREATE POLICY "Achievements public" ON icao5_trainer.achievements FOR SELECT USING (true);

-- 4. User Achievements: 用户读自己的
DROP POLICY IF EXISTS "Users view own achievements" ON icao5_trainer.user_achievements;
CREATE POLICY "Users view own achievements" ON icao5_trainer.user_achievements FOR SELECT USING (auth.uid() = user_id);

-- ==============================================================================
-- 数据迁移 (Seed Data)
-- 将 trainingData.ts 中的部分核心场景写入数据库
-- ==============================================================================
INSERT INTO icao5_trainer.scenarios (code, category, title, details, phase, weather, difficulty_level)
VALUES 
-- Ground Ops
('push_complex', 'Operational & Weather', 'Conditional Pushback', 'Ready for pushback. Tug connected. Expect conditional clearance due to traffic behind.', 'Ground Ops', 'VMC', 'Medium'),
('taxi_giveway', 'Operational & Weather', 'Complex Taxi Instructions', 'Taxi to holding point 36R via Alpha, Bravo. Give way to B737 passing left to right.', 'Ground Ops', 'VMC', 'Hard'),
('apu_fire', 'Powerplant', 'APU Fire on Ground', 'Fire bell ringing during pre-flight. Request fire services.', 'Ground Ops', 'VMC', 'Hard'),

-- Takeoff & Climb
('eng_fire', 'Powerplant', 'Engine Fire on Departure', 'MAYDAY. Engine No.2 Fire. Request immediate return.', 'Takeoff & Climb', 'VMC', 'Hard'),
('abort_tfc', 'Security & External Hazards', 'Rejected Takeoff (Traffic)', 'Vehicle entering runway. Stop immediately! Cancel takeoff clearance.', 'Takeoff & Climb', 'VMC', 'Hard'),

-- Cruise
('hyd_fail', 'Systems', 'Loss of Hydraulic Sys A', 'Loss of system A pressure. Manual gear extension will be required.', 'Cruise & Enroute', 'VMC', 'Hard'),
('incap', 'Medical & Human Factors', 'Pilot Incapacitation', 'Captain has fainted (food poisoning). FO flying solo.', 'Cruise & Enroute', 'VMC', 'Extreme'),
('wx_dev', 'Operational & Weather', 'Weather Deviation', 'Request deviation 10 miles right of track to avoid build-ups.', 'Cruise & Enroute', 'CB Clouds Vicinity', 'Medium'),

-- Descent
('gear_unsafe', 'Landing Gear, Brakes & Tires', 'Landing Gear Unsafe', 'Nose gear light remains red. Request orbit to troubleshoot.', 'Descent & Approach', 'VMC', 'Medium'),
('min_fuel', 'Systems', 'Minimum Fuel', 'Holding time exceeded. Declaring Minimum Fuel. Request priority vectoring.', 'Descent & Approach', 'VMC', 'Hard'),

-- Landing
('brake_fail', 'Landing Gear, Brakes & Tires', 'Brake Failure', 'Loss of normal braking on landing roll. Stopping on runway.', 'Landing & Taxi in', 'VMC', 'Hard'),

-- Go-around
('go_around_ws', 'Operational & Weather', 'Go-Around (Windshear)', 'Windshear warning on short final. Going around.', 'Go-around & Diversion', 'Windshear reported', 'Hard'),
('div_medical', 'Medical & Human Factors', 'Diversion (Medical)', 'Passenger condition worsening. Diverting to nearest suitable airport.', 'Go-around & Diversion', 'VMC', 'Medium')
ON CONFLICT (code) DO UPDATE SET 
    details = EXCLUDED.details,
    title = EXCLUDED.title,
    phase = EXCLUDED.phase;

-- 初始化成就
INSERT INTO icao5_trainer.achievements (code, name, description, icon_url)
VALUES
('FIRST_FLIGHT', 'First Flight', 'Complete your first training session.', '🏆'),
('LEVEL_4_PASSED', 'ICAO Level 4', 'Achieve a score of 4 or higher in an assessment.', '✈️'),
('LEVEL_5_MASTER', 'Level 5 Master', 'Achieve a score of 5 or higher.', '⭐'),
('STREAK_7', 'Weekly Warrior', 'Train for 7 consecutive days.', '🔥')
ON CONFLICT (code) DO NOTHING;
