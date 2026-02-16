
import { supabase } from './supabaseClient';

export const configService = {
    /**
     * Retrieves the Google API Key.
     * Priority 1: Supabase Database (app_config table)
     * Priority 2: Environment Variable (process.env.API_KEY)
     */
    async getGoogleApiKey(): Promise<string | null> {
        try {
            // 1. Try fetching from DB (for deployed production safety)
            const { data, error } = await supabase
                .from('app_config')
                .select('key_value')
                .eq('key_name', 'GOOGLE_API_KEY')
                .single();

            if (!error && data && data.key_value && data.key_value !== 'YOUR_ACTUAL_GEMINI_KEY_HERE') {
                console.log("Using API Key from Supabase Database");
                return data.key_value;
            }
        } catch (e) {
            console.warn("Failed to fetch API Key from DB, falling back to Env:", e);
        }

        // 2. Fallback to build-time Env Var
        if (process.env.API_KEY) {
            // console.log("Using API Key from Environment");
            return process.env.API_KEY;
        }

        return null;
    }
};
