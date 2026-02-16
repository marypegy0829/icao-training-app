
-- ==============================================================================
-- ICAO Level 5 Examiner - 配置与密钥存储 (v4.0)
-- 目的：将敏感的 API Key 移出前端代码，存储在数据库中动态拉取
-- ==============================================================================

-- 1. 创建配置表
CREATE TABLE IF NOT EXISTS icao5_trainer.app_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT UNIQUE NOT NULL,  -- e.g. 'GOOGLE_API_KEY'
    key_value TEXT NOT NULL,        -- The actual key
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 安全策略 (RLS)
ALTER TABLE icao5_trainer.app_config ENABLE ROW LEVEL SECURITY;

-- 允许认证用户读取配置 (注意：这意味着登录用户可以获取 Key，但比硬编码安全)
-- 更高级的做法是使用 Edge Function 代理，但当前架构为纯前端直连 WebSocket。
CREATE POLICY "Allow authenticated read config" 
ON icao5_trainer.app_config 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 3. 插入初始数据 (占位符，请在 Supabase SQL 编辑器中运行并替换为真实 Key)
-- 注意：如果是第一次运行，请将 'YOUR_ACTUAL_GEMINI_KEY_HERE' 替换为真实的 Key
INSERT INTO icao5_trainer.app_config (key_name, key_value, description)
VALUES 
('GOOGLE_API_KEY', 'YOUR_ACTUAL_GEMINI_KEY_HERE', 'Gemini Live API Key used by frontend clients')
ON CONFLICT (key_name) DO NOTHING;
