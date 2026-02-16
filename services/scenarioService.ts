
import { supabase } from './supabaseClient';
import { Scenario, FlightPhase } from '../types';
import { TRAINING_SCENARIOS, PHASE_LOGIC_CONFIG, TrainingTag } from './trainingData';

export const scenarioService = {
    // Simple in-memory cache to prevent redundant network calls
    _cache: null as Scenario[] | null,

    // Fetch all active scenarios
    async getAllScenarios(forceRefresh = false): Promise<Scenario[]> {
        if (this._cache && !forceRefresh) {
            return this._cache;
        }

        const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.warn("Failed to fetch scenarios from DB, using local fallback:", error);
            // Default to local scenarios if DB is unreachable
            return TRAINING_SCENARIOS;
        }

        if (!data || data.length === 0) {
            return TRAINING_SCENARIOS;
        }

        // Map DB fields to Frontend types
        const mappedScenarios = data.map((item: any) => ({
            id: item.code, // Map 'code' to 'id' for frontend compatibility
            title: item.title,
            details: item.details,
            phase: item.phase as FlightPhase,
            category: item.category,
            weather: item.weather,
            difficulty_level: item.difficulty_level, // Map difficulty
            tags: item.tags || [], // Map tags if available in DB (requires new column or logic)
            callsign: 'Training ' + Math.floor(Math.random() * 900 + 100)
        }));

        this._cache = mappedScenarios;
        return mappedScenarios;
    },

    // Pick a random scenario suited for assessment
    async getRandomAssessmentScenario(): Promise<Scenario> {
        const scenarios = await this.getAllScenarios();
        
        // Filter logic: Prefer scenarios that are NOT 'Ground Ops' for assessment 
        // to test higher stakes communication.
        const validPhases: FlightPhase[] = [
            'Takeoff & Climb', 
            'Cruise & Enroute', 
            'Descent & Approach', 
            'Go-around & Diversion', 
            'Landing & Taxi in'
        ];
        
        // Anti-Error Logic: Ensure the scenario's tags actually make sense for the phase
        // (Even if DB has bad data, this protects the exam experience)
        const candidates = scenarios.filter(s => {
            if (!s.phase || !validPhases.includes(s.phase)) return false;
            
            // Check if scenario has tags, and if any of those tags are valid for the phase
            // Local scenarios have tags typed. DB ones might need parsing.
            const sTags = (s as any).tags as TrainingTag[];
            if (!sTags || sTags.length === 0) return true; // Loose allow if no tags

            const validTags = PHASE_LOGIC_CONFIG[s.phase];
            if (!validTags) return true;

            // At least one tag should match the valid tags for this phase
            return sTags.some(t => validTags.includes(t));
        });
        
        // Fallback to all scenarios if filter returns empty
        const pool = candidates.length > 0 ? candidates : scenarios;
        
        return pool[Math.floor(Math.random() * pool.length)];
    }
};
