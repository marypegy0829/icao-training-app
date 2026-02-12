
-- ==============================================================================
-- ICAO Level 5 Examiner - 100 场景库填充脚本
-- 覆盖所有飞行阶段与特情类别
-- ==============================================================================

-- 确保 Schema
CREATE SCHEMA IF NOT EXISTS icao5_trainer;

-- 批量插入数据 (使用 UPSERT 策略: 如果 code 存在则更新，不存在则插入)
INSERT INTO icao5_trainer.scenarios (code, category, phase, title, difficulty_level, weather, details)
VALUES 

-- ==============================================================================
-- PHASE 1: GROUND OPS (地面准备与滑行) - 20 Scenarios
-- ==============================================================================
('gnd_01', 'Operational & Weather', 'Ground Ops', 'Slot Time Delay', 'Medium', 'VMC', 'CTOT (Calculated Takeoff Time) issued. 30 minute delay. Request startup to meet new slot time.'),
('gnd_02', 'Medical & Human Factors', 'Ground Ops', 'Sick Passenger at Gate', 'Medium', 'VMC', 'Passenger complaining of severe chest pain during boarding. Request paramedics to gate immediately.'),
('gnd_03', 'Systems', 'Ground Ops', 'Hydraulic Leak', 'Hard', 'Light Rain', 'Ground crew reports red fluid leaking from right main gear. Request maintenance inspection.'),
('gnd_04', 'Operational & Weather', 'Ground Ops', 'De-icing Required', 'Medium', 'Snow, -2C', 'Moderate snow falling. Request taxi to remote de-icing pad before departure.'),
('gnd_05', 'Security & External Hazards', 'Ground Ops', 'Unattended Baggage', 'Hard', 'VMC', 'Ground crew spotted suspicious unattended baggage near the nose gear. Request security.'),
('gnd_06', 'Operational & Weather', 'Ground Ops', 'Incorrect Taxiway', 'Hard', 'Fog, RVR 400m', 'Low visibility. You have inadvertently turned onto Taxiway Charlie instead of Bravo. Report position.'),
('gnd_07', 'Powerplant', 'Ground Ops', 'Hot Start', 'Hard', 'VMC', 'Engine No.2 EGT rising rapidly during start. Aborting start. Request fire monitor.'),
('gnd_08', 'Operational & Weather', 'Ground Ops', 'Pushback Tug Failure', 'Medium', 'VMC', 'Pushback tug has broken down halfway onto the taxiway. Blocking traffic. Request assistance.'),
('gnd_09', 'Operational & Weather', 'Ground Ops', 'Conditional Line Up', 'Medium', 'VMC', 'Expect conditional line up. Traffic is a B777 on short final (2 miles).'),
('gnd_10', 'Systems', 'Ground Ops', 'Parking Brake Failure', 'Hard', 'VMC', 'Parking brake not holding. Chocks required immediately.'),
('gnd_11', 'Medical & Human Factors', 'Ground Ops', 'Crew Member Incapacitated', 'Extreme', 'VMC', 'Cabin crew member collapsed during safety demo. Return to stand required.'),
('gnd_12', 'Security & External Hazards', 'Ground Ops', 'Animal on Taxiway', 'Medium', 'VMC', 'Stray dogs spotted crossing Taxiway Alpha. Holding position.'),
('gnd_13', 'Operational & Weather', 'Ground Ops', 'Follow Me Car Request', 'Medium', 'Heavy Rain', 'Unfamiliar airport layout and heavy rain. Request "Follow Me" car to the gate.'),
('gnd_14', 'Operational & Weather', 'Ground Ops', 'Gate Occupied', 'Medium', 'VMC', 'Arrived at assigned gate 12, but it is occupied by another aircraft. Request new gate.'),
('gnd_15', 'Fire, Smoke & Pressurization', 'Ground Ops', 'Fuel Spill', 'Hard', 'VMC', 'Large fuel spill observed during refueling. Evacuating ground staff. Request fire services.'),
('gnd_16', 'Operational & Weather', 'Ground Ops', 'Intersection Departure', 'Medium', 'VMC', 'Request departure from intersection Bravo 2 to avoid long taxi delays.'),
('gnd_17', 'Systems', 'Ground Ops', 'APU Failure', 'Medium', 'Hot 35C', 'APU inoperative. Request ground power unit (GPU) and air start unit.'),
('gnd_18', 'Operational & Weather', 'Ground Ops', 'Visual Check Request', 'Medium', 'VMC', 'Suspected open panel on left wing. Request tower/ground for visual check as we taxi past.'),
('gnd_19', 'Security & External Hazards', 'Ground Ops', 'Laser at Tower', 'Hard', 'Night', 'Report green laser beam originating from the car park targeting the cockpit while taxiing.'),
('gnd_20', 'Landing Gear, Brakes & Tires', 'Ground Ops', 'Flat Spot on Tire', 'Medium', 'VMC', 'Maintenance reports tire wear limit. Need to return to stand for wheel change.'),

-- ==============================================================================
-- PHASE 2: TAKEOFF & CLIMB (起飞与爬升) - 20 Scenarios
-- ==============================================================================
('dep_01', 'Powerplant', 'Takeoff & Climb', 'Engine Failure V1', 'Extreme', 'VMC', 'Engine failure right at V1. Continued takeoff. Engine fire warning. Mayday.'),
('dep_02', 'Security & External Hazards', 'Takeoff & Climb', 'Bird Strike (No Damage)', 'Medium', 'VMC', 'Hit a flock of birds at 200ft. Engines stable. Continuing but request runway inspection.'),
('dep_03', 'Security & External Hazards', 'Takeoff & Climb', 'Bird Strike (Engine Stall)', 'Hard', 'VMC', 'Bird ingestion No.1 engine. Severe vibration. Leveling off at 3000ft. Return to land.'),
('dep_04', 'Operational & Weather', 'Takeoff & Climb', 'Windshear Alert', 'Hard', 'Stormy', 'Windshear warning on departure. Loss of 15 knots airspeed. Windshear escape maneuver active.'),
('dep_05', 'Fire, Smoke & Pressurization', 'Takeoff & Climb', 'Cabin Smoke', 'Extreme', 'VMC', 'Smoke reported in rear galley 2 minutes after takeoff. Immediate return.'),
('dep_06', 'Landing Gear, Brakes & Tires', 'Takeoff & Climb', 'Gear Not Retracting', 'Hard', 'VMC', 'Landing gear lever stuck in down position. Unable to retract. Speed restricted. Returning.'),
('dep_07', 'Operational & Weather', 'Takeoff & Climb', 'TCAS RA (Climb)', 'Hard', 'VMC', 'TCAS Resolution Advisory: "CLIMB". Deviating from clearance to avoid conflicting traffic.'),
('dep_08', 'Systems', 'Takeoff & Climb', 'Door Open Light', 'Medium', 'VMC', 'Cargo door warning light illuminated passing 5000ft. Pressurization normal but returning as precaution.'),
('dep_09', 'Medical & Human Factors', 'Takeoff & Climb', 'Pilot Incapacitation', 'Extreme', 'VMC', 'Captain has fainted. First Officer flying solo. Declaring emergency.'),
('dep_10', 'Operational & Weather', 'Takeoff & Climb', 'Unstable Weather Ahead', 'Medium', 'CB Clouds', 'Heavy build-ups on departure path. Request immediate turn heading 270 to avoid.'),
('dep_11', 'Powerplant', 'Takeoff & Climb', 'Engine Compressor Stall', 'Hard', 'VMC', 'Loud bangs from right engine. Compressor stall. Reducing thrust. Leveling off.'),
('dep_12', 'Operational & Weather', 'Takeoff & Climb', 'Rejected Takeoff (High Speed)', 'Extreme', 'VMC', 'Fire warning at 100 knots. Stopping on runway. Request fire brigade.'),
('dep_13', 'Security & External Hazards', 'Takeoff & Climb', 'Drone Encounter', 'Hard', 'VMC', 'Near miss with a large drone at 1500ft. Passing left side. Reporting incident.'),
('dep_14', 'Operational & Weather', 'Takeoff & Climb', 'Level Bust', 'Medium', 'VMC', 'Distraction caused altitude deviation. Climbed 500ft above assigned altitude. Correcting.'),
('dep_15', 'Systems', 'Takeoff & Climb', 'Airspeed Unreliable', 'Hard', 'Icing', 'Pitot tubes suspected blocked. Indicated airspeed fluctuating. maintaining pitch and power.'),
('dep_16', 'Fire, Smoke & Pressurization', 'Takeoff & Climb', 'Tail Strike Suspected', 'Medium', 'Gusty Winds', 'Possible tail strike on rotation due to gust. Pressurization checking. Request visual check from tower.'),
('dep_17', 'Operational & Weather', 'Takeoff & Climb', 'Runway Incursion on Dep', 'Extreme', 'Fog', 'Vehicle entered runway while we were on takeoff roll. Rejected takeoff immediately.'),
('dep_18', 'Systems', 'Takeoff & Climb', 'Flight Control Issue', 'Hard', 'VMC', 'Slats jam detected. Unable to clean up configuration. Holding at 4000ft.'),
('dep_19', 'Powerplant', 'Takeoff & Climb', 'Oil Pressure Low', 'Medium', 'VMC', 'No.2 Engine oil pressure low/amber. Monitoring. Request level off to troubleshoot.'),
('dep_20', 'Operational & Weather', 'Takeoff & Climb', 'Communication Failure', 'Hard', 'VMC', 'Total radio failure after departure. Squawking 7600. Following lost comms procedure.'),

-- ==============================================================================
-- PHASE 3: CRUISE & ENROUTE (巡航与航路) - 20 Scenarios
-- ==============================================================================
('crs_01', 'Medical & Human Factors', 'Cruise & Enroute', 'Heart Attack', 'Hard', 'VMC', 'Passenger (Male, 50s) suspected heart attack. Doctor on board recommends immediate diversion.'),
('crs_02', 'Fire, Smoke & Pressurization', 'Cruise & Enroute', 'Rapid Depressurization', 'Extreme', 'VMC', 'Explosive decompression. Emergency descent to FL100 initiated. Mayday.'),
('crs_03', 'Operational & Weather', 'Cruise & Enroute', 'Severe Turbulence', 'Hard', 'CAT', 'Encountered unexpected Severe Clear Air Turbulence. Several passengers injured. Request lower level.'),
('crs_04', 'Systems', 'Cruise & Enroute', 'Fuel Leak', 'Hard', 'VMC', 'Significant fuel imbalance. Visual spray from left wing. Shutting down left engine to prevent fire risk.'),
('crs_05', 'Security & External Hazards', 'Cruise & Enroute', 'Unruly Passenger', 'Hard', 'VMC', 'Passenger violent, attacking crew. Restrained. Request police upon arrival. Diversion needed.'),
('crs_06', 'Operational & Weather', 'Cruise & Enroute', 'Volcanic Ash', 'Extreme', 'Night', 'St Elmos fire on windshield. Acrid smell. Suspect volcanic ash. Turning 180 degrees.'),
('crs_07', 'Medical & Human Factors', 'Cruise & Enroute', 'Childbirth', 'Medium', 'VMC', 'Passenger in labor. Not critical yet, but requesting priority and medical at destination.'),
('crs_08', 'Systems', 'Cruise & Enroute', 'Dual FMGC Failure', 'Hard', 'VMC', 'Loss of both Flight Management Computers. Reverting to raw data navigation. Request vectors.'),
('crs_09', 'Powerplant', 'Cruise & Enroute', 'Engine Flameout', 'Hard', 'Icing', 'Engine No.1 flameout likely due to ice. Attempting relight. Descending to relight envelope.'),
('crs_10', 'Fire, Smoke & Pressurization', 'Cruise & Enroute', 'Cargo Fire Warning', 'Extreme', 'VMC', 'Aft Cargo Smoke detector activated. Discharged bottles. Warning persists. Diverting immediately.'),
('crs_11', 'Operational & Weather', 'Cruise & Enroute', 'Weather Wall', 'Medium', 'Thunderstorms', 'Solid line of thunderstorms ahead. Request deviation 20 miles Right of track.'),
('crs_12', 'Systems', 'Cruise & Enroute', 'Electrical Failure', 'Hard', 'VMC', 'Loss of AC BUS 1 and 2. On Emergency Power (RAT deployed). Limited comms/nav.'),
('crs_13', 'Security & External Hazards', 'Cruise & Enroute', 'Bomb Threat', 'Extreme', 'VMC', 'Received specific note regarding a bomb on board. Request immediate diversion to isolated stand.'),
('crs_14', 'Operational & Weather', 'Cruise & Enroute', 'Minimum Fuel Declaration', 'Hard', 'Headwinds', 'Stronger than forecast headwinds. Fuel reserves low. Declaring Minimum Fuel. Priority required.'),
('crs_15', 'Medical & Human Factors', 'Cruise & Enroute', 'Food Poisoning', 'Medium', 'VMC', 'Multiple crew and passengers sick. Suspect food poisoning. Request quarantine advice.'),
('crs_16', 'Systems', 'Cruise & Enroute', 'Hydraulic Loss (Green)', 'Hard', 'VMC', 'Loss of Green Hydraulic system. Landing distance will increase. Request long runway.'),
('crs_17', 'Fire, Smoke & Pressurization', 'Cruise & Enroute', 'Electrical Smell', 'Medium', 'VMC', 'Strong burning smell in cockpit. No visible smoke. Running checklist. Pan-Pan.'),
('crs_18', 'Operational & Weather', 'Cruise & Enroute', 'GPS Jamming', 'Medium', 'VMC', 'Loss of GPS signal. RNP capability lost. Request radar vectors.'),
('crs_19', 'Systems', 'Cruise & Enroute', 'Windshield Crack', 'Medium', 'VMC', 'Outer ply of Captains windshield cracked. Visibility okay, but speed restricted. Descending.'),
('crs_20', 'Medical & Human Factors', 'Cruise & Enroute', 'Hypoxia Symptoms', 'Hard', 'VMC', 'FO reporting dizziness and tingling. Cabin alt is normal, but suspect CO contamination. Donning masks.'),

-- ==============================================================================
-- PHASE 4: DESCENT & APPROACH (下降与进近) - 20 Scenarios
-- ==============================================================================
('app_01', 'Landing Gear, Brakes & Tires', 'Descent & Approach', 'Gear Unsafe Indication', 'Hard', 'VMC', 'Nose gear light red (unsafe) after extension. Request orbit to troubleshoot/gravity extension.'),
('app_02', 'Systems', 'Descent & Approach', 'Flap Jam', 'Hard', 'VMC', 'Flaps jammed at 10 degrees. High speed landing expected. Request emergency equipment standby.'),
('app_03', 'Operational & Weather', 'Descent & Approach', 'ILS Failure', 'Medium', 'IMC', 'ILS signal unreliable. Discontinuing approach. Request RNAV (RNP) approach.'),
('app_04', 'Security & External Hazards', 'Descent & Approach', 'Laser Attack', 'Hard', 'Night', 'Green laser hit cockpit on base leg. Pilot temporarily blinded. Breaking off approach.'),
('app_05', 'Operational & Weather', 'Descent & Approach', 'Holding for Weather', 'Medium', 'Storms', 'Destination airport closed due to storm cell over field. Request holding at fix for 20 mins.'),
('app_06', 'Systems', 'Descent & Approach', 'Radar Failure', 'Medium', 'IMC', 'Weather radar failed. Cannot see cells ahead. Request ATC guidance through weather.'),
('app_07', 'Operational & Weather', 'Descent & Approach', 'Go-Around (Unstabilized)', 'Medium', 'Crosswind', 'Gusty crosswinds. Unstabilized at minima. Going around.'),
('app_08', 'Operational & Weather', 'Descent & Approach', 'Runway Change', 'Medium', 'VMC', 'Wind shift. ATC changes runway at late stage. Re-briefing approach. Request vectoring for time.'),
('app_09', 'Systems', 'Descent & Approach', 'Radio Altimeter Fail', 'Hard', 'Fog', 'Radio Altimeters failed. Cannot conduct CAT II/III approach. Diverting to alternate with better weather.'),
('app_10', 'Medical & Human Factors', 'Descent & Approach', 'Pilot Fatigue', 'Medium', 'Night', 'Crew duty time limit approaching. Must land within 20 mins or divert to closer alternate.'),
('app_11', 'Operational & Weather', 'Descent & Approach', 'Speed Control', 'Medium', 'VMC', 'Unable to maintain 160kts to 4 miles due to heavy weight/configuration. Request 180kts.'),
('app_12', 'Landing Gear, Brakes & Tires', 'Descent & Approach', 'Manual Gear Extension', 'Hard', 'VMC', 'Hydraulic failure. Performing manual gear extension. Will not be able to retract once down.'),
('app_13', 'Security & External Hazards', 'Descent & Approach', 'UAV in Approach Path', 'Hard', 'VMC', 'Drone reported 300ft below glide slope at 4 miles. Visual contact. Deviating slightly right.'),
('app_14', 'Operational & Weather', 'Descent & Approach', 'Glideslope Fluctuating', 'Medium', 'IMC', 'Glideslope unreliable. Switching to Localizer-only approach.'),
('app_15', 'Systems', 'Descent & Approach', 'Spoiler Fault', 'Medium', 'VMC', 'Speedbrakes/Spoilers inoperative. Descent rate limited. Request extra track miles.'),
('app_16', 'Operational & Weather', 'Descent & Approach', 'Fuel Critical', 'Extreme', 'VMC', 'Holding for 30 mins. Now reaching minimal reserve. Mayday Fuel. Immediate landing required.'),
('app_17', 'Fire, Smoke & Pressurization', 'Descent & Approach', 'Avionics Smoke', 'Hard', 'IMC', 'Smoke from pedestal. Checklist complete. Vision slightly impaired. Request ILS full lights.'),
('app_18', 'Operational & Weather', 'Descent & Approach', 'Traffic Alert', 'Hard', 'VMC', 'Traffic 12 oclock same level. TCAS RA "DESCEND". Breaking off approach.'),
('app_19', 'Systems', 'Descent & Approach', 'Autopilot Disconnect', 'Medium', 'Turbulence', 'Autopilot disconnect in turbulence. Hand flying. Standby for level readbacks.'),
('app_20', 'Landing Gear, Brakes & Tires', 'Descent & Approach', 'Asymmetric Flaps', 'Hard', 'VMC', 'Flaps stopped asymmetrically. Roll control difficult. Declaring Emergency.'),

-- ==============================================================================
-- PHASE 5: LANDING & TAXI IN (着陆与滑回) - 10 Scenarios
-- ==============================================================================
('lnd_01', 'Landing Gear, Brakes & Tires', 'Landing & Taxi in', 'Tire Burst on Landing', 'Hard', 'VMC', 'Two tires burst on main gear upon touchdown. Vibration. Stopping on runway. Request assistance.'),
('lnd_02', 'Landing Gear, Brakes & Tires', 'Landing & Taxi in', 'Brake Failure', 'Extreme', 'Wet', 'Loss of normal braking. Using emergency brake. Risk of overrun. Mayday.'),
('lnd_03', 'Operational & Weather', 'Landing & Taxi in', 'Runway Excursion', 'Extreme', 'Icy', 'Slid off the side of runway due to ice. Gear collapsed. Evacuation initiating.'),
('lnd_04', 'Landing Gear, Brakes & Tires', 'Landing & Taxi in', 'Hot Brakes Fire', 'Hard', 'VMC', 'Tower reports smoke from wheels after heavy braking. Stop on taxiway. Fire services required.'),
('lnd_05', 'Systems', 'Landing & Taxi in', 'Nose Wheel Steering Fail', 'Medium', 'VMC', 'Unable to vacate runway. NWS failure. Engines shutting down. Tow required.'),
('lnd_06', 'Operational & Weather', 'Landing & Taxi in', 'Missed Exit', 'Medium', 'Low Vis', 'Missed high speed exit due to fog. Backtracking runway to exit Alpha.'),
('lnd_07', 'Operational & Weather', 'Landing & Taxi in', 'Gate Blocked', 'Medium', 'VMC', 'Assigned gate occupied. Holding on taxiway. Request new gate info.'),
('lnd_08', 'Systems', 'Landing & Taxi in', 'Reverser Unlocked', 'Medium', 'VMC', 'No.1 Thrust Reverser unlocked light during taxi. Idle power only.'),
('lnd_09', 'Operational & Weather', 'Landing & Taxi in', 'Follow Me Required', 'Medium', 'Construction', 'Airport construction complex. Request Follow Me car to navigate to stand.'),
('lnd_10', 'Medical & Human Factors', 'Landing & Taxi in', 'Medical Pax Unconscious', 'Hard', 'VMC', 'Pax condition deteriorated during landing. Unconscious. Request ambulance meet aircraft at stand.'),

-- ==============================================================================
-- PHASE 6: GO-AROUND & DIVERSION (复飞与备降) - 10 Scenarios
-- ==============================================================================
('ga_01', 'Operational & Weather', 'Go-around & Diversion', 'Runway Occupied', 'Hard', 'VMC', 'Vehicle on runway. Tower instructs Go Around. Executing missed approach.'),
('ga_02', 'Operational & Weather', 'Go-around & Diversion', 'Below Minima', 'Medium', 'Fog', 'Decision Height reached. No visual reference. Go around. Diverting to Alternate.'),
('ga_03', 'Operational & Weather', 'Go-around & Diversion', 'Windshear on Final', 'Hard', 'Storm', 'Reactive windshear warning. Go around. Maximum thrust. Diverting due to weather.'),
('ga_04', 'Systems', 'Go-around & Diversion', 'Gear Not Down', 'Hard', 'VMC', 'Gear warning horn at 500ft. Gear not locked. Go around. Troubleshooting.'),
('ga_05', 'Operational & Weather', 'Go-around & Diversion', 'Unstable Approach', 'Medium', 'Tailwind', 'Tailwind pushed speed high. Unstable at 1000ft. Going around.'),
('ga_06', 'Security & External Hazards', 'Go-around & Diversion', 'Animal Incursion', 'Medium', 'VMC', 'Tower reports deer on runway. Go around initiated.'),
('ga_07', 'Medical & Human Factors', 'Go-around & Diversion', 'Divert - Medical', 'Medium', 'VMC', 'Passenger heart attack worsens. Destination weather deteriorated. Diverting to nearest suitable airport.'),
('ga_08', 'Powerplant', 'Go-around & Diversion', 'Engine Fail on GA', 'Extreme', 'VMC', 'Engine failure during go-around climb. Single engine missed approach procedure.'),
('ga_09', 'Operational & Weather', 'Go-around & Diversion', 'Blocked Runway', 'Medium', 'VMC', 'Previous arrival burst tire. Runway closed. Diverting to alternate.'),
('ga_10', 'Systems', 'Go-around & Diversion', 'Fuel Imbalance Divert', 'Hard', 'VMC', 'Fuel leak confirmed. Cannot reach destination with reserves. Diverting to enroute alternate.')

-- UPSERT 逻辑：防止重复并更新内容
ON CONFLICT (code) DO UPDATE SET 
    category = EXCLUDED.category,
    phase = EXCLUDED.phase,
    title = EXCLUDED.title,
    difficulty_level = EXCLUDED.difficulty_level,
    weather = EXCLUDED.weather,
    details = EXCLUDED.details;
