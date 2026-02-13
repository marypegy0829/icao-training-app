
-- ==============================================================================
-- ICAO Level 5 Examiner - 评分系统数据库升级 (v3.3 - Fix)
-- 目的：结构化存储 6 大维度评分，支持 SQL 级的数据分析与看板生成
-- 修复：自动检测并补充缺失的 session_type 字段
-- ==============================================================================

-- 1. [关键修复] 确保 session_type 字段存在
-- 如果表是旧版本创建的，可能缺少此字段。我们先添加它。
ALTER TABLE icao5_trainer.training_logs 
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'TRAINING';

-- 2. 扩展 training_logs 表：添加 6 大维度分项成绩列
ALTER TABLE icao5_trainer.training_logs 
ADD COLUMN IF NOT EXISTS score_pronunciation SMALLINT,
ADD COLUMN IF NOT EXISTS score_structure SMALLINT,
ADD COLUMN IF NOT EXISTS score_vocabulary SMALLINT,
ADD COLUMN IF NOT EXISTS score_fluency SMALLINT,
ADD COLUMN IF NOT EXISTS score_comprehension SMALLINT,
ADD COLUMN IF NOT EXISTS score_interactions SMALLINT,
ADD COLUMN IF NOT EXISTS is_operational BOOLEAN DEFAULT false, -- 是否达到 Level 4+
ADD COLUMN IF NOT EXISTS fail_reason TEXT; -- 导致低分的关键因素

-- 3. 数据迁移：尝试从现有的 JSONB details 中提取历史数据
-- 现在的 session_type 字段已保证存在，可以安全执行 WHERE 过滤
UPDATE icao5_trainer.training_logs
SET 
    score_pronunciation = (details->>'pronunciation')::int,
    score_structure = (details->>'structure')::int,
    score_vocabulary = (details->>'vocabulary')::int,
    score_fluency = (details->>'fluency')::int,
    score_comprehension = (details->>'comprehension')::int,
    score_interactions = (details->>'interactions')::int,
    is_operational = ((details->>'overallScore')::int >= 4),
    fail_reason = details->'executiveSummary'->>'frictionPoints'
WHERE 
    session_type = 'ASSESSMENT' 
    AND details IS NOT NULL 
    AND score_pronunciation IS NULL; -- 避免重复处理

-- 4. 创建分析视图：飞行员能力概览
-- 此视图将用于替换前端的本地计算逻辑，直接在数据库层聚合数据
DROP VIEW IF EXISTS icao5_trainer.pilot_competency_view;

CREATE OR REPLACE VIEW icao5_trainer.pilot_competency_view AS
SELECT 
    user_id,
    COUNT(id) FILTER (WHERE session_type = 'ASSESSMENT') as total_assessments,
    
    -- 核心指标平均分 (保留1位小数)
    ROUND(AVG(score_pronunciation)::numeric, 1) as avg_pronunciation,
    ROUND(AVG(score_structure)::numeric, 1) as avg_structure,
    ROUND(AVG(score_vocabulary)::numeric, 1) as avg_vocabulary,
    ROUND(AVG(score_fluency)::numeric, 1) as avg_fluency,
    ROUND(AVG(score_comprehension)::numeric, 1) as avg_comprehension,
    ROUND(AVG(score_interactions)::numeric, 1) as avg_interactions,
    
    -- 最近一次评估的通过状态
    (SELECT is_operational FROM icao5_trainer.training_logs t2 
     WHERE t2.user_id = training_logs.user_id AND t2.session_type = 'ASSESSMENT' 
     ORDER BY created_at DESC LIMIT 1) as last_status,
     
    MAX(created_at) as last_assessment_date
FROM icao5_trainer.training_logs
WHERE session_type = 'ASSESSMENT'
GROUP BY user_id;

-- 5. 授权访问视图
GRANT SELECT ON icao5_trainer.pilot_competency_view TO authenticated, service_role;
