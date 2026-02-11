
import { Scenario, FlightPhase } from '../types';

export const SCENARIO_CATEGORIES = [
  "Operational & Weather", // New category for routine but complex interactions
  "Powerplant",
  "Fire, Smoke & Pressurization",
  "Landing Gear, Brakes & Tires",
  "Systems",
  "Medical & Human Factors",
  "Security & External Hazards"
] as const;

export type ScenarioCategory = typeof SCENARIO_CATEGORIES[number];

// Helper to create scenarios easily
const create = (
  id: string, 
  category: ScenarioCategory, 
  title: string, 
  details: string, 
  phase: FlightPhase,
  weather: string = 'VMC, Wind Calm, CAVOK'
): Scenario => ({
  id,
  category,
  title,
  details,
  phase,
  weather, 
  callsign: 'Training 001'
});

export const TRAINING_SCENARIOS: Scenario[] = [
  // ============================================================
  // PHASE 1: GROUND OPS (地面准备与滑行)
  // Focus: Pushback, Complex Taxi, Delays, Ground Issues
  // ============================================================
  create('push_complex', 'Operational & Weather', 'Conditional Pushback', 'Ready for pushback. Tug connected. Expect conditional clearance due to traffic behind.', 'Ground Ops'),
  create('taxi_giveway', 'Operational & Weather', 'Complex Taxi Instructions', 'Taxi to holding point 36R via Alpha, Bravo. Give way to B737 passing left to right.', 'Ground Ops'),
  create('slot_delay', 'Operational & Weather', 'CTOT / Slot Delay', 'We have a slot time of 45. Request start up at 35 to meet CTOT.', 'Ground Ops'),
  create('tech_return', 'Operational & Weather', 'Return to Stand', 'Technical trouble after pushback. Request return to stand.', 'Ground Ops'),
  create('vis_taxi', 'Operational & Weather', 'Low Visibility Taxi', 'LVO procedures in force. Taxi via greens to CAT III holding point.', 'Ground Ops', 'RVR 350m, Fog'),
  create('apu_fire', 'Powerplant', 'APU Fire on Ground', 'Fire bell ringing during pre-flight. Request fire services.', 'Ground Ops'),
  create('hot_brakes', 'Landing Gear, Brakes & Tires', 'Hot Brakes', 'Brake overheat warning after heavy braking on arrival/taxi.', 'Ground Ops'),

  // ============================================================
  // PHASE 2: TAKEOFF & CLIMB (起飞与爬升)
  // Focus: Takeoff Clearance, Immediate Departure, Level Change
  // ============================================================
  create('imm_dep', 'Operational & Weather', 'Immediate Departure', 'Traffic on final (3 miles). Request immediate departure.', 'Takeoff & Climb'),
  create('abort_tfc', 'Security & External Hazards', 'Rejected Takeoff (Traffic)', 'Vehicle entering runway. Stop immediately! Cancel takeoff clearance.', 'Takeoff & Climb'),
  create('eng_v1', 'Powerplant', 'Engine Failure after V1', 'Engine failure immediately after V1 call. Continue takeoff. Mayday.', 'Takeoff & Climb'),
  create('eng_fire', 'Powerplant', 'Engine Fire on Departure', 'MAYDAY. Engine No.2 Fire. Request immediate return.', 'Takeoff & Climb'),
  create('tire_burst', 'Landing Gear, Brakes & Tires', 'Tire Burst on Takeoff', 'Loud bang on takeoff run. Suspected tire burst. Continuing to safety altitude.', 'Takeoff & Climb'),
  create('level_turb', 'Operational & Weather', 'Level Off (Turbulence)', 'Request to level off at 6000m due to severe turbulence in climb.', 'Takeoff & Climb', 'Mod/Sev Turbulence'),
  create('perf_climb', 'Operational & Weather', 'Unable Expedite Climb', 'Unable to comply with expedite instruction due to heavy weight/performance.', 'Takeoff & Climb'),
  create('alt_warn', 'Fire, Smoke & Pressurization', 'Cabin Altitude Warning', 'Intermittent cabin altitude horn during climb. Leveling off.', 'Takeoff & Climb'),

  // ============================================================
  // PHASE 3: CRUISE & ENROUTE (巡航与航路)
  // Focus: Wx Deviation, Turbulence, Routing, Medical
  // ============================================================
  create('wx_dev', 'Operational & Weather', 'Weather Deviation', 'Request deviation 10 miles right of track to avoid build-ups.', 'Cruise & Enroute', 'CB Clouds Vicinity'),
  create('wx_heading', 'Operational & Weather', 'Vector for Weather', 'We are avoiding weather. Request heading 090 for 20 miles.', 'Cruise & Enroute', 'Thunderstorms'),
  create('turb_desc', 'Operational & Weather', 'Descent for Smooth Air', 'Reporting moderate to severe turbulence at FL300. Request descent FL280.', 'Cruise & Enroute', 'CAT reported'),
  create('direct_rte', 'Operational & Weather', 'Direct Routing', 'Request direct to VOR ABC to save fuel/time.', 'Cruise & Enroute'),
  create('incap', 'Medical & Human Factors', 'Pilot Incapacitation', 'Captain has fainted (food poisoning). FO flying solo.', 'Cruise & Enroute'),
  create('heart_atk', 'Medical & Human Factors', 'Passenger Heart Attack', 'Passenger requiring immediate medical assistance. Request diversion.', 'Cruise & Enroute'),
  create('labor', 'Medical & Human Factors', 'Passenger in Labor', 'Pregnant passenger giving birth. Request priority.', 'Cruise & Enroute'),
  create('depress', 'Fire, Smoke & Pressurization', 'Rapid Depressurization', 'Explosive decompression. Emergency descent required.', 'Cruise & Enroute'),
  create('cargo_fire', 'Fire, Smoke & Pressurization', 'Cargo Fire', 'Forward cargo smoke detector activated.', 'Cruise & Enroute'),
  create('hyd_fail', 'Systems', 'Loss of Hydraulic Sys A', 'Loss of system A pressure. Manual gear extension will be required.', 'Cruise & Enroute'),
  create('fuel_leak', 'Systems', 'Fuel Leak', 'Visible fuel spray from left wing. Checking balance.', 'Cruise & Enroute'),
  create('eng_fail', 'Powerplant', 'Engine Failure', 'Engine flameout. Drifting down.', 'Cruise & Enroute'),
  create('smoke_cockpit', 'Fire, Smoke & Pressurization', 'Smoke in Cockpit', 'Acrid smell and visible smoke. Donning masks.', 'Cruise & Enroute'),
  create('unruly', 'Security & External Hazards', 'Unruly Passenger', 'Passenger fighting with crew. Restraints applied. Request police.', 'Cruise & Enroute'),
  create('ash', 'Security & External Hazards', 'Volcanic Ash', 'Entering visible ash cloud. Engine parameters fluctuating.', 'Cruise & Enroute'),

  // ============================================================
  // PHASE 4: DESCENT & APPROACH (下降与进近)
  // Focus: Vectoring, Holding, Approach Stability
  // ============================================================
  create('vec_ils', 'Operational & Weather', 'Vector to Intercept', 'Turn left heading 240 to intercept the localizer 27L.', 'Descent & Approach'),
  create('min_fuel', 'Systems', 'Minimum Fuel', 'Holding time exceeded. Declaring Minimum Fuel. Request priority vectoring.', 'Descent & Approach'),
  create('gear_unsafe', 'Landing Gear, Brakes & Tires', 'Landing Gear Unsafe', 'Nose gear light remains red. Request orbit to troubleshoot.', 'Descent & Approach'),
  create('flap_asy', 'Systems', 'Flap Asymmetry', 'Flaps locked between positions. High speed approach expected.', 'Descent & Approach'),
  create('laser', 'Security & External Hazards', 'Laser Illumination', 'Green laser flash in cockpit on final.', 'Descent & Approach'),
  create('drone', 'Security & External Hazards', 'Drone Sighting', 'Drone reported 100ft below on final approach path.', 'Descent & Approach'),

  // ============================================================
  // PHASE 5: LANDING & TAXI IN (着陆与滑回)
  // Focus: Landing Issues, Vacating, Ground Handling
  // ============================================================
  create('low_pass', 'Operational & Weather', 'Low Pass / Gear Check', 'Request low pass for tower to visually inspect landing gear.', 'Landing & Taxi in'),
  create('follow_me', 'Operational & Weather', 'Follow Me Car', 'Unfamiliar with airport. Request Follow Me car to stand.', 'Landing & Taxi in'),
  create('vacate_issue', 'Operational & Weather', 'Unable to Vacate', 'Missed exit due to slippery runway. Backtracking required.', 'Landing & Taxi in', 'Heavy Rain'),
  create('brake_fail', 'Landing Gear, Brakes & Tires', 'Brake Failure', 'Loss of normal braking on landing roll. Stopping on runway.', 'Landing & Taxi in'),
  create('nose_steer', 'Landing Gear, Brakes & Tires', 'Nose Wheel Steering Fail', 'Unable to vacate runway. NWS failure. Tow truck required.', 'Landing & Taxi in'),
  create('flat_tire_land', 'Landing Gear, Brakes & Tires', 'Flat Tire on Landing', 'Aircraft pulling to left on rollout. Suspected tire burst.', 'Landing & Taxi in'),

  // ============================================================
  // PHASE 6: GO-AROUND & DIVERSION (复飞与备降)
  // Focus: Missed Approach, Weather Avoidance, Diversion
  // ============================================================
  create('go_around_ws', 'Operational & Weather', 'Go-Around (Windshear)', 'Windshear warning on short final. Going around.', 'Go-around & Diversion', 'Windshear reported'),
  create('go_around_uns', 'Operational & Weather', 'Unstabilized Approach', 'Too high and fast. Unstabilized. Going around.', 'Go-around & Diversion'),
  create('go_around_rwy', 'Operational & Weather', 'Go-Around (Runway Occupied)', 'Aircraft still on runway. Going around.', 'Go-around & Diversion'),
  create('div_weather', 'Operational & Weather', 'Diversion (Weather)', 'Destination below minima. Requesting diversion to Alternate.', 'Go-around & Diversion', 'Fog, RVR 200m'),
  create('div_medical', 'Medical & Human Factors', 'Diversion (Medical)', 'Passenger condition worsening. Diverting to nearest suitable airport.', 'Go-around & Diversion'),
];

export function getRandomAssessmentScenario(): Scenario {
    // Assessment logic: Prefer more complex scenarios from Phase 2, 3, 6
    const validPhases: FlightPhase[] = ['Takeoff & Climb', 'Cruise & Enroute', 'Go-around & Diversion'];
    const candidates = TRAINING_SCENARIOS.filter(s => s.phase && validPhases.includes(s.phase));
    return candidates[Math.floor(Math.random() * candidates.length)];
}
