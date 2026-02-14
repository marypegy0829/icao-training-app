
import { supabase } from './supabaseClient';
import { FlightPhase } from '../types';

export const ruleService = {
    /**
     * Fetches a combined string of AI Logic Rules based on the flight phase.
     * Includes Global Rules + Phase Specific Rules.
     */
    async getLogicRulesForPhase(phase: FlightPhase): Promise<string> {
        try {
            // 1. Fetch Global Rules
            const { data: globalRules, error: globalError } = await supabase
                .from('ai_logic_rules')
                .select('prompt_text')
                .eq('is_global', true);

            if (globalError) throw globalError;

            // 2. Fetch Phase Specific Rule Codes
            const { data: mappings, error: mapError } = await supabase
                .from('phase_rule_mappings')
                .select('rule_code')
                .eq('flight_phase', phase);

            if (mapError) throw mapError;

            let specificRules: any[] = [];
            if (mappings && mappings.length > 0) {
                const codes = mappings.map(m => m.rule_code);
                const { data: specific, error: specificError } = await supabase
                    .from('ai_logic_rules')
                    .select('prompt_text')
                    .in('rule_code', codes);
                
                if (specificError) throw specificError;
                specificRules = specific || [];
            }

            // 3. Combine
            const allPrompts = [
                ...(globalRules?.map(r => r.prompt_text) || []),
                ...(specificRules?.map(r => r.prompt_text) || [])
            ];

            if (allPrompts.length === 0) return "";

            return `
### 🛡️ FLIGHT LOGIC & OPERATIONAL CONSTRAINTS (MANDATORY)
You are bound by ICAO PANS-ATM (Doc 4444). VIOLATION IS A SAFETY FAILURE.

${allPrompts.join('\n')}
            `;

        } catch (e) {
            console.error("Failed to fetch AI Logic Rules:", e);
            // Fallback: Return empty string so the app doesn't crash, just runs with less strict logic
            return "";
        }
    }
};
