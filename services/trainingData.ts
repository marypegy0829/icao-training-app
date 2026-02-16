
import { Scenario, FlightPhase } from '../types';

// 1. Broad Categories (Existing)
export const SCENARIO_CATEGORIES = [
  "Operational & Weather", 
  "Powerplant",
  "Fire, Smoke & Pressurization",
  "Landing Gear, Brakes & Tires",
  "Systems",
  "Medical & Human Factors",
  "Security & External Hazards"
] as const;

export type ScenarioCategory = typeof SCENARIO_CATEGORIES[number];

// 2. Granular Tags (New: For finer filtering and logic enforcement)
export type TrainingTag = 
  | 'Hydraulics' | 'Electrics' | 'Fuel' | 'Nav/Comms' | 'Flight Controls' // Systems
  | 'Engine Fail' | 'Engine Fire' | 'Bird Strike' // Powerplant
  | 'Gear' | 'Brakes' | 'Tires' | 'Steering' // Landing Gear
  | 'De-icing' | 'Windshear' | 'Visibility' | 'Turbulence' | 'Runway State' // Weather
  | 'Medical' | 'Incapacitation' | 'Fatigue' // Human
  | 'Unruly Pax' | 'Bomb Threat' | 'Laser' | 'Drone'; // Security

// 3. Logic Matrix: Defines valid failures for each flight phase (Flight Logic / Anti-Error)
export const PHASE_LOGIC_CONFIG: Record<FlightPhase, TrainingTag[]> = {
    'Ground Ops': [
        'Steering', 'Brakes', 'Tires', 'De-icing', 'Medical', 'Engine Fire', 
        'Hydraulics', 'Electrics', 'Visibility', 'Unruly Pax', 'Nav/Comms'
    ],
    'Takeoff & Climb': [
        'Engine Fail', 'Engine Fire', 'Bird Strike', 'Windshear', 'Tires', 
        'Gear', 'Pressurization' as any, 'Medical', 'Drone', 'Runway State'
    ],
    'Cruise & Enroute': [
        'Medical', 'Incapacitation', 'Pressurization' as any, 'Turbulence', 
        'Fuel', 'Electrics', 'Hydraulics', 'Unruly Pax', 'Engine Fail', 'Fire' as any
    ],
    'Descent & Approach': [
        'Gear', 'Flaps' as any, 'Hydraulics', 'Fuel', 'Windshear', 'Visibility',
        'Laser', 'Drone', 'Medical', 'Nav/Comms'
    ],
    'Landing & Taxi in': [
        'Brakes', 'Tires', 'Steering', 'Runway State', 'Windshear', 
        'Medical', 'Hydraulics', 'Gear'
    ],
    'Go-around & Diversion': [
        'Fuel', 'Windshear', 'Visibility', 'Gear', 'Engine Fail', 
        'Runway State', 'Medical'
    ]
};

// Helper to create scenarios easily
const create = (
  id: string, 
  category: ScenarioCategory, 
  title: string, 
  details: string, 
  phase: FlightPhase,
  tags: TrainingTag[], // Added Tags
  weather: string = 'VMC, Wind Calm, CAVOK',
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme' = 'Medium'
): Scenario & { tags: TrainingTag[] } => ({
  id,
  category,
  title,
  details,
  phase,
  weather, 
  difficulty_level: difficulty,
  callsign: 'Training 001',
  tags: tags
});

export const TRAINING_SCENARIOS: (Scenario & { tags: TrainingTag[] })[] = [
  // ============================================================
  // PHASE 1: GROUND OPS
  // ============================================================
  create('push_complex', 'Operational & Weather', 'Conditional Pushback', 'Ready for pushback. Tug connected. Expect conditional clearance due to traffic behind.', 'Ground Ops', ['Visibility'], 'VMC', 'Medium'),
  create('taxi_giveway', 'Operational & Weather', 'Complex Taxi Instructions', 'Taxi to holding point active runway via specific route. Give way to crossing traffic.', 'Ground Ops', ['Visibility'], 'VMC', 'Hard'),
  create('slot_delay', 'Operational & Weather', 'CTOT / Slot Delay', 'We have a slot time restriction. Request start up to meet new CTOT.', 'Ground Ops', ['Nav/Comms'], 'VMC', 'Medium'),
  create('apu_fire', 'Powerplant', 'APU Fire on Ground', 'Fire bell ringing during pre-flight. Request fire services immediately.', 'Ground Ops', ['Engine Fire'], 'VMC', 'Hard'),
  create('vis_taxi', 'Operational & Weather', 'Low Visibility Taxi', 'LVO procedures in force. Taxi via greens to CAT III holding point.', 'Ground Ops', ['Visibility'], 'RVR 350m, Fog', 'Hard'),
  create('med_gate', 'Medical & Human Factors', 'Sick Passenger at Gate', 'Passenger complaining of chest pain during boarding. Request paramedics.', 'Ground Ops', ['Medical'], 'VMC', 'Medium'),
  create('hyd_leak_gnd', 'Systems', 'Hydraulic Leak on Stand', 'Ground crew noticed red fluid leak. Maintenance required.', 'Ground Ops', ['Hydraulics'], 'VMC', 'Medium'),

  // ============================================================
  // PHASE 2: TAKEOFF & CLIMB
  // ============================================================
  create('eng_fire', 'Powerplant', 'Engine Fire on Departure', 'MAYDAY. Engine No.2 Fire immediately after airborne. Request immediate return.', 'Takeoff & Climb', ['Engine Fire'], 'VMC', 'Hard'),
  create('abort_tfc', 'Security & External Hazards', 'Rejected Takeoff (Traffic)', 'Vehicle entering runway. Stop immediately! Cancel takeoff clearance.', 'Takeoff & Climb', ['Runway State'], 'VMC', 'Hard'),
  create('eng_v1', 'Powerplant', 'Engine Failure V1', 'Engine failure right at V1. Continued takeoff. Engine fire warning. Mayday.', 'Takeoff & Climb', ['Engine Fail'], 'VMC', 'Extreme'),
  create('windshear_dep', 'Operational & Weather', 'Windshear Alert', 'Windshear warning on departure. Loss of airspeed. Escape maneuver.', 'Takeoff & Climb', ['Windshear'], 'Stormy', 'Hard'),
  create('bird_strike', 'Security & External Hazards', 'Bird Strike', 'Hit flock of birds. Vibration No.1 engine. Returning to land.', 'Takeoff & Climb', ['Bird Strike', 'Engine Fail'], 'VMC', 'Medium'),
  create('tcas_ra', 'Operational & Weather', 'TCAS RA Climb', 'Traffic Conflict. TCAS Resolution Advisory "CLIMB". Deviating from clearance.', 'Takeoff & Climb', ['Nav/Comms'], 'VMC', 'Hard'),

  // ============================================================
  // PHASE 3: CRUISE & ENROUTE
  // ============================================================
  create('incap', 'Medical & Human Factors', 'Pilot Incapacitation', 'Captain has fainted (food poisoning). FO flying solo. Mayday.', 'Cruise & Enroute', ['Incapacitation'], 'VMC', 'Extreme'),
  create('hyd_fail', 'Systems', 'Loss of Hydraulic Sys A', 'Loss of system A pressure. Manual gear extension will be required.', 'Cruise & Enroute', ['Hydraulics'], 'VMC', 'Hard'),
  create('wx_dev', 'Operational & Weather', 'Weather Deviation', 'Request deviation 10 miles right of track to avoid build-ups.', 'Cruise & Enroute', ['Turbulence'], 'CB Clouds Vicinity', 'Medium'),
  create('depress', 'Fire, Smoke & Pressurization', 'Rapid Depressurization', 'Explosive decompression. Emergency descent to FL100 initiated. Mayday.', 'Cruise & Enroute', ['Pressurization' as any], 'VMC', 'Extreme'),
  create('unruly', 'Security & External Hazards', 'Unruly Passenger', 'Passenger fighting with crew. Restraints applied. Request police on arrival.', 'Cruise & Enroute', ['Unruly Pax'], 'VMC', 'Hard'),
  create('fuel_leak', 'Systems', 'Fuel Leak', 'Visible fuel spray from left wing. Checking balance. Shutting down engine.', 'Cruise & Enroute', ['Fuel', 'Engine Fail'], 'VMC', 'Hard'),
  create('volcanic_ash', 'Security & External Hazards', 'Volcanic Ash Encounter', 'St Elmos fire, acrid smell. Turning 180 degrees immediately.', 'Cruise & Enroute', ['Visibility', 'Engine Fail'], 'Night', 'Extreme'),

  // ============================================================
  // PHASE 4: DESCENT & APPROACH
  // ============================================================
  create('gear_unsafe', 'Landing Gear, Brakes & Tires', 'Landing Gear Unsafe', 'Nose gear light remains red. Request orbit to troubleshoot/gravity extension.', 'Descent & Approach', ['Gear'], 'VMC', 'Hard'),
  create('min_fuel', 'Systems', 'Minimum Fuel', 'Holding time exceeded. Declaring Minimum Fuel. Request priority vectoring.', 'Descent & Approach', ['Fuel'], 'Headwinds', 'Hard'),
  create('laser', 'Security & External Hazards', 'Laser Illumination', 'Green laser flash in cockpit on final. Vision impaired temporarily.', 'Descent & Approach', ['Laser', 'Visibility'], 'Night', 'Medium'),
  create('flap_jam', 'Systems', 'Flap Jam', 'Flaps jammed at 10 degrees. High speed landing expected. Request emergency equipment.', 'Descent & Approach', ['Flaps' as any, 'Flight Controls'], 'VMC', 'Hard'),
  create('ils_fail', 'Operational & Weather', 'ILS Failure', 'Glide path unreliable. Discontinuing approach. Request RNAV/Visual.', 'Descent & Approach', ['Nav/Comms'], 'IMC', 'Medium'),

  // ============================================================
  // PHASE 5: LANDING & TAXI IN
  // ============================================================
  create('brake_fail', 'Landing Gear, Brakes & Tires', 'Brake Failure', 'Loss of normal braking on landing roll. Using emergency brake. Risk of overrun.', 'Landing & Taxi in', ['Brakes'], 'Wet', 'Extreme'),
  create('tire_burst_land', 'Landing Gear, Brakes & Tires', 'Tire Burst on Landing', 'Vibration and loud bang on touchdown. Stopping on runway.', 'Landing & Taxi in', ['Tires'], 'VMC', 'Hard'),
  create('vacate_issue', 'Operational & Weather', 'Unable to Vacate', 'Missed exit due to slippery runway. Backtracking required.', 'Landing & Taxi in', ['Runway State'], 'Heavy Rain', 'Medium'),
  create('nws_fail', 'Systems', 'Nose Wheel Steering Fail', 'Unable to vacate runway. NWS failure. Tow truck required.', 'Landing & Taxi in', ['Steering'], 'VMC', 'Medium'),

  // ============================================================
  // PHASE 6: GO-AROUND & DIVERSION
  // ============================================================
  create('go_around_ws', 'Operational & Weather', 'Go-Around (Windshear)', 'Windshear warning on short final. Going around.', 'Go-around & Diversion', ['Windshear'], 'Windshear reported', 'Hard'),
  create('div_medical', 'Medical & Human Factors', 'Diversion (Medical)', 'Passenger condition worsening. Diverting to nearest suitable airport.', 'Go-around & Diversion', ['Medical'], 'VMC', 'Medium'),
  create('div_wx', 'Operational & Weather', 'Diversion (Weather)', 'Destination below minima. Requesting diversion to Alternate.', 'Go-around & Diversion', ['Visibility'], 'Fog', 'Medium'),
  create('blocked_rwy', 'Operational & Weather', 'Blocked Runway', 'Previous arrival burst tire. Runway closed. Diverting.', 'Go-around & Diversion', ['Runway State'], 'VMC', 'Medium'),
];

export function getRandomAssessmentScenario(): Scenario {
    // Assessment logic: Prefer more complex scenarios from Phase 2, 3, 6
    const validPhases: FlightPhase[] = ['Takeoff & Climb', 'Cruise & Enroute', 'Go-around & Diversion'];
    const candidates = TRAINING_SCENARIOS.filter(s => s.phase && validPhases.includes(s.phase));
    return candidates[Math.floor(Math.random() * candidates.length)];
}
