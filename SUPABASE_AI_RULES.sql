
-- ==============================================================================
-- ICAO Level 5 Examiner - AI 核心防呆逻辑库 (Dynamic Context Injection)
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS icao5_trainer;

-- 1. 规则定义表 (Rule Definitions)
CREATE TABLE IF NOT EXISTS icao5_trainer.ai_logic_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code TEXT UNIQUE NOT NULL, -- e.g., 'RULE_1A'
    category TEXT,                  -- e.g., 'JURISDICTION', 'PHYSICS'
    description TEXT,               -- Human readable summary
    prompt_text TEXT NOT NULL,      -- The actual prompt instruction
    is_global BOOLEAN DEFAULT false -- If true, injected into ALL sessions
);

-- 2. 阶段映射表 (Phase Mappings)
CREATE TABLE IF NOT EXISTS icao5_trainer.phase_rule_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_phase TEXT NOT NULL,     -- Matches 'FlightPhase' type in frontend
    rule_code TEXT NOT NULL REFERENCES icao5_trainer.ai_logic_rules(rule_code) ON DELETE CASCADE
);

-- RLS Policies
ALTER TABLE icao5_trainer.ai_logic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE icao5_trainer.phase_rule_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Rules" ON icao5_trainer.ai_logic_rules FOR SELECT USING (true);
CREATE POLICY "Public Read Mappings" ON icao5_trainer.phase_rule_mappings FOR SELECT USING (true);

-- ==============================================================================
-- SEED DATA: 注入核心逻辑 (Core Logic Injection)
-- ==============================================================================

-- 清理旧数据 (防止重复)
TRUNCATE icao5_trainer.phase_rule_mappings;
TRUNCATE icao5_trainer.ai_logic_rules CASCADE;

-- A. 插入规则库
INSERT INTO icao5_trainer.ai_logic_rules (rule_code, category, is_global, description, prompt_text)
VALUES 
-- 1. GLOBAL CORE (全局核心 - 任何阶段都生效)
('RULE_2A', 'READBACKS', true, 'Strict Hold Short Readbacks', 
 '- RULE_2A: "HOLD SHORT" (等待外). You must demand a strict, verbatim readback of the runway holding point. If pilot omits runway designator, CORRECT THEM.'),
('RULE_4A', 'EMERGENCY', true, 'Mayday vs Pan-Pan', 
 '- RULE_4A: "MAYDAY" = Immediate danger/priority. "PAN-PAN" = Urgency. Treat distinctly.'),
('RULE_4B', 'EMERGENCY', true, 'Priority Handling', 
 '- RULE_4B: PRIORITY. If MAYDAY declared, HALT other comms. Grant requested heading/altitude. NEVER tell Mayday to "Expect holding".'),
('RULE_5B', 'WEATHER', true, 'Wind Limitations', 
 '- RULE_5B: WIND LIMITS. Be aware of crosswind limits. If wind is out of limits, expect pilot to reject clearance.'),

-- 2. GROUND OPS (地面)
('RULE_1A', 'JURISDICTION', false, 'Ground Control Limits', 
 '- RULE_1A: GROUND CONTROL (GND). Controls taxiways. CANNOT issue Takeoff/Landing clearances or vectors.'),
('RULE_2C', 'CLEARANCES', false, 'Conditional Clearances', 
 '- RULE_2C: CONDITIONAL CLEARANCES. Format: [Callsign], [Condition], [Clearance]. Example: "Behind the B737, line up and wait." NEVER issue conditional takeoff.'),

-- 3. TOWER / TAKEOFF / LANDING (塔台)
('RULE_1B', 'JURISDICTION', false, 'Tower Control Limits', 
 '- RULE_1B: TOWER CONTROL (TWR). Issues "Cleared for takeoff/land". DOES NOT issue long-range radar vectors.'),
('RULE_2B', 'CLEARANCES', false, 'Line Up vs Takeoff', 
 '- RULE_2B: "LINE UP AND WAIT" vs "CLEARED FOR TAKEOFF". Mutually exclusive in one transmission. NEVER say both together.'),

-- 4. APPROACH / RADAR (进近)
('RULE_1C', 'JURISDICTION', false, 'Approach Control Limits', 
 '- RULE_1C: APPROACH (APP). Sequences traffic, issues vectors/ILS clearance. CANNOT issue "Cleared to land".'),
('RULE_3A', 'PHYSICS', false, 'Speed Restrictions', 
 '- RULE_3A: SPEED. Below 10,000ft max 250kt. Final approach (4NM) speed 130-160kt. Do not request 210kt at threshold.'),
('RULE_3C', 'PHYSICS', false, 'Descend Via STAR', 
 '- RULE_3C: DESCEND VIA. Do not issue hard altitudes contradicting a "Descend via STAR" clearance unless explicitly cancelling restrictions.'),
('RULE_5A', 'WEATHER', false, 'IMC Logic', 
 '- RULE_5A: IMC/LVP. If visibility low (e.g. Fog), DO NOT issue visual clearances. Enforce ILS/CAT procedures.'),

-- 5. ENROUTE / CRUISE (航路)
('RULE_3B', 'PHYSICS', false, 'Altitude Physics', 
 '- RULE_3B: ALTITUDE. Do not issue descent to 1,000ft if aircraft is 50NM away. Respect MSA.'),
('RULE_4C', 'EMERGENCY', false, 'Fuel Logic', 
 '- RULE_4C: MIN FUEL vs MAYDAY FUEL. Min Fuel = No Delay (No priority). Mayday Fuel = Immediate Priority.');


-- B. 建立映射关系 (Map Rules to Phases)
-- Ground Ops
INSERT INTO icao5_trainer.phase_rule_mappings (flight_phase, rule_code)
VALUES 
('Ground Ops', 'RULE_1A'),
('Ground Ops', 'RULE_2C');

-- Takeoff & Climb / Landing & Taxi in (Tower Environment)
INSERT INTO icao5_trainer.phase_rule_mappings (flight_phase, rule_code)
VALUES 
('Takeoff & Climb', 'RULE_1B'),
('Takeoff & Climb', 'RULE_2B'),
('Landing & Taxi in', 'RULE_1B'), -- Landing also needs Tower rules
('Landing & Taxi in', 'RULE_2B');

-- Descent & Approach / Go-around (Approach Environment)
INSERT INTO icao5_trainer.phase_rule_mappings (flight_phase, rule_code)
VALUES 
('Descent & Approach', 'RULE_1C'),
('Descent & Approach', 'RULE_3A'),
('Descent & Approach', 'RULE_3C'),
('Descent & Approach', 'RULE_5A'),
('Go-around & Diversion', 'RULE_1C'),
('Go-around & Diversion', 'RULE_3A');

-- Cruise & Enroute
INSERT INTO icao5_trainer.phase_rule_mappings (flight_phase, rule_code)
VALUES 
('Cruise & Enroute', 'RULE_3B'),
('Cruise & Enroute', 'RULE_4C');
