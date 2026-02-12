
import { supabase } from './supabaseClient';
import { Scenario, FlightPhase } from '../types';
import { TRAINING_SCENARIOS } from './trainingData';

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
            callsign: 'Training ' + Math.floor(Math.random() * 900 + 100)
        }));

        this._cache = mappedScenarios;
        return mappedScenarios;
    },

    // Pick a random scenario suited for assessment
    async getRandomAssessmentScenario(): Promise<Scenario> {
        const scenarios = await this.getAllScenarios();
        
        // Filter logic: Prefer scenarios that are NOT 'Ground Ops' for assessment 
        // to test higher stakes communication, unless the user needs basic training.
        // We select phases that involve active flight control.
        const validPhases: FlightPhase[] = [
            'Takeoff & Climb', 
            'Cruise & Enroute', 
            'Descent & Approach', 
            'Go-around & Diversion', 
            'Landing & Taxi in'
        ];
        
        const candidates = scenarios.filter(s => s.phase && validPhases.includes(s.phase));
        
        // Fallback to all scenarios if filter returns empty
        const pool = candidates.length > 0 ? candidates : scenarios;
        
        return pool[Math.floor(Math.random() * pool.length)];
    }
};
